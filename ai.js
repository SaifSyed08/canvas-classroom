// "Ask anything" pill: a star in a circle that opens into a small chat about his classes.
// The model runs in background.js (it holds the OpenAI key); this file draws the pill,
// keeps the history (sessionStorage, per tab) and runs the read-only Canvas tools.
(() => {
  'use strict';
  if (window.top !== window) return;
  const gcx = window.gcx;
  if (!gcx) return;
  const { api, esc } = gcx;
  const DAY = 864e5;
  const MAX_OUT = 30000;
  const MAX_ROUNDS = 10;

  // ---------------------------------------------------------------- text helpers
  const decode = (s) =>
    s
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&amp;/g, '&');
  function htmlToText(html) {
    if (!html) return '';
    return decode(
      String(html)
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
        .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
          const label = t.replace(/<[^>]+>/g, '').trim();
          return label && label !== href ? `${label} (${href})` : href;
        })
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<\/(p|div|h[1-6]|li|tr|table|ul|ol|blockquote)>/gi, '\n')
        .replace(/<\/t[dh]>/gi, ' | ')
        .replace(/<[^>]+>/g, ''),
    )
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  const clip = (s, n = 20000) => (s && s.length > n ? s.slice(0, n) + '\n…(cut off)' : s);
  const fileIdsIn = (html) => [...new Set([...String(html || '').matchAll(/\/files\/(\d+)/g)].map((m) => m[1]))];
  const rel = (u) => (u ? String(u).replace(location.origin, '') : undefined);

  // ---------------------------------------------------------------- read-only Canvas tools
  // Mirrors Canvas Portal's tool set (minus anything that writes).
  const obj = (props, required = []) => ({ type: 'object', properties: props, required });
  const ID = { type: ['integer', 'string'] };
  const courseNames = new Map();
  async function courses() {
    const list = await gcx.coursesReady;
    list.forEach((c) => courseNames.set(String(c.id), gcx.prettyName(c)));
    return list.map((c) => ({
      id: c.id,
      name: gcx.prettyName(c),
      code: c.code,
      term: c.term,
      teachers: (c.teachers || []).map((t) => t.name),
      grade: c.score != null ? `${c.letter ? c.letter + ' ' : ''}${+c.score.toFixed(2)}%` : undefined,
      url: `/courses/${c.id}`,
    }));
  }

  const TOOLS = [
    {
      name: 'list_courses',
      label: 'Checking your classes',
      description: "Saif's current Canvas courses with ids, instructors and current grade.",
      parameters: obj({}),
      run: courses,
    },
    {
      name: 'upcoming',
      label: 'Checking your planner',
      description:
        'Everything on the Canvas planner in a window around today, across all courses: assignments, quizzes, discussions, with due dates and whether each is submitted, missing or graded.',
      parameters: obj({
        days: { type: 'integer', description: 'Days ahead (default 14)' },
        past_days: { type: 'integer', description: 'Days back (default 7)' },
        course_id: { ...ID, description: 'Optional: only this course' },
      }),
      run: async ({ days = 14, past_days = 7, course_id }) => {
        const start = new Date(Date.now() - past_days * DAY).toISOString();
        const end = new Date(Date.now() + days * DAY).toISOString();
        const q = course_id ? `&context_codes[]=course_${course_id}` : '';
        const items = await api(`/planner/items?start_date=${start}&end_date=${end}&per_page=100${q}`, true);
        return items.map((it) => {
          const p = it.plannable || {};
          const s = it.submissions || {};
          return {
            type: it.plannable_type,
            title: p.title || p.name,
            course: it.context_name,
            course_id: it.course_id,
            assignment_id: it.plannable_type === 'assignment' ? it.plannable_id : p.assignment_id || undefined,
            due: it.plannable_date,
            points: p.points_possible,
            submitted: !!s.submitted || undefined,
            missing: !!s.missing || undefined,
            graded: !!s.graded || undefined,
            late: !!s.late || undefined,
            marked_done: !!(it.planner_override && it.planner_override.marked_complete) || undefined,
            url: it.plannable_type === 'planner_note' ? '/calendar' : rel(it.html_url),
          };
        });
      },
    },
    {
      name: 'list_assignments',
      label: 'Looking through assignments',
      description: 'Assignments in one course with due dates, points, submission status and score.',
      parameters: obj(
        {
          course_id: ID,
          bucket: { type: 'string', enum: ['upcoming', 'future', 'past', 'overdue', 'unsubmitted', 'ungraded', 'undated'], description: 'Optional filter' },
        },
        ['course_id'],
      ),
      run: async ({ course_id, bucket }) => {
        const list = await api(`/courses/${course_id}/assignments?include[]=submission&order_by=due_at&per_page=100` + (bucket ? '&bucket=' + encodeURIComponent(bucket) : ''), true);
        return list.map((a) => {
          const s = a.submission || {};
          return {
            id: a.id,
            name: a.name,
            due_at: a.due_at,
            points: a.points_possible,
            submission_types: a.submission_types,
            status: s.workflow_state,
            score: s.score ?? undefined,
            late: s.late || undefined,
            missing: s.missing || undefined,
            url: rel(a.html_url),
          };
        });
      },
    },
    {
      name: 'get_assignment',
      label: 'Reading the assignment',
      description:
        "Full detail for one assignment: instructions, rubric, lock dates, Saif's submission and grade, and grader comments. Lists ids of Canvas files the instructions link to (read_file opens them).",
      parameters: obj({ course_id: ID, assignment_id: ID }, ['course_id', 'assignment_id']),
      run: async ({ course_id, assignment_id }) => {
        const [a, mine] = await Promise.all([
          api(`/courses/${course_id}/assignments/${assignment_id}?include[]=submission`),
          api(`/courses/${course_id}/assignments/${assignment_id}/submissions/self?include[]=submission_comments&include[]=rubric_assessment`).catch(() => null),
        ]);
        const s = mine || a.submission || {};
        return {
          id: a.id,
          name: a.name,
          due_at: a.due_at,
          unlock_at: a.unlock_at,
          lock_at: a.lock_at,
          points: a.points_possible,
          submission_types: a.submission_types,
          allowed_attempts: a.allowed_attempts,
          locked: a.locked_for_user || undefined,
          instructions: clip(htmlToText(a.description), 12000),
          linked_file_ids: fileIdsIn(a.description),
          rubric: (a.rubric || []).map((r) => ({ criterion: r.description, points: r.points, detail: r.long_description })),
          submission: {
            state: s.workflow_state,
            submitted_at: s.submitted_at,
            score: s.score,
            grade: s.grade,
            late: s.late,
            missing: s.missing,
            files: (s.attachments || []).map((f) => ({ file_id: f.id, name: f.display_name })),
          },
          comments: (s.submission_comments || []).map((c) => ({ from: c.author_name, at: c.created_at, text: clip(c.comment || '', 2000) })),
          is_quiz: !!(a.is_quiz_lti_assignment || a.quiz_id) || undefined,
          url: rel(a.html_url),
        };
      },
    },
    {
      name: 'get_grades',
      label: 'Checking your grades',
      description: "A course's grades: current overall grade, assignment groups with weights, and every assignment's score with missing/late/excused flags.",
      parameters: obj({ course_id: ID }, ['course_id']),
      run: async ({ course_id }) => {
        const [course, enr, groups] = await Promise.all([
          api(`/courses/${course_id}`),
          api(`/courses/${course_id}/enrollments?user_id=self&type[]=StudentEnrollment&per_page=10`).catch(() => []),
          api(`/courses/${course_id}/assignment_groups?include[]=assignments&include[]=submission&per_page=50`, true),
        ]);
        const g = (enr[0] && enr[0].grades) || {};
        const weighted = !!course.apply_assignment_group_weights;
        return {
          course: course.name,
          current_score: g.current_score ?? null,
          current_grade: g.current_grade || null,
          note: g.current_score == null ? 'Canvas is not showing a course total (the instructor may hide it).' : undefined,
          weighted_by_group: weighted,
          grades_url: `/courses/${course_id}/grades`,
          groups: groups.map((gr) => ({
            group: gr.name,
            weight_percent: weighted ? gr.group_weight : undefined,
            drop_lowest: (gr.rules && gr.rules.drop_lowest) || undefined,
            assignments: (gr.assignments || []).map((a) => {
              const s = a.submission || {};
              return {
                name: a.name,
                due_at: a.due_at,
                points: a.points_possible,
                score: s.score ?? null,
                missing: s.missing || undefined,
                late: s.late || undefined,
                excused: s.excused || undefined,
                submitted: !!s.submitted_at,
              };
            }),
          })),
        };
      },
    },
    {
      name: 'get_feedback',
      label: 'Reading grader feedback',
      description: "Every grader comment and rubric score on Saif's work in one course, newest first.",
      parameters: obj({ course_id: ID }, ['course_id']),
      run: async ({ course_id }) => {
        const [subs, assigns] = await Promise.all([
          api(`/courses/${course_id}/students/submissions?student_ids[]=self&include[]=submission_comments&include[]=rubric_assessment&per_page=100`, true),
          api(`/courses/${course_id}/assignments?per_page=100`, true),
        ]);
        const byId = new Map(assigns.map((a) => [a.id, a]));
        const out = subs
          .map((s) => {
            const a = byId.get(s.assignment_id) || {};
            const comments = (s.submission_comments || []).map((c) => ({ from: c.author_name, at: c.created_at, text: clip(c.comment || '', 2000) }));
            const crit = new Map((a.rubric || []).map((r) => [r.id, r]));
            const rubric = Object.entries(s.rubric_assessment || {}).map(([cid, r]) => ({
              criterion: (crit.get(cid) || {}).description || cid,
              points: r.points,
              out_of: (crit.get(cid) || {}).points,
              comment: r.comments || undefined,
            }));
            if (!comments.length && !rubric.length) return null;
            return { assignment: a.name, score: s.score, points: a.points_possible, graded_at: s.graded_at, comments, rubric: rubric.length ? rubric : undefined, url: rel(a.html_url) };
          })
          .filter(Boolean)
          .sort((x, y) => String(y.graded_at || '').localeCompare(String(x.graded_at || '')));
        return out.length ? out : 'No comments or rubric scores in this course yet.';
      },
    },
    {
      name: 'list_announcements',
      label: 'Reading announcements',
      description: 'Recent announcements from one course or all of them.',
      parameters: obj({ course_id: { ...ID, description: 'Leave out for every course' }, days: { type: 'integer', description: 'How far back (default 21)' } }),
      run: async ({ course_id, days = 21 }) => {
        const ids = course_id ? [course_id] : (await courses()).map((c) => c.id);
        if (!ids.length) return [];
        const start = new Date(Date.now() - days * DAY).toISOString();
        const q = ids.map((i) => 'context_codes[]=course_' + i).join('&');
        const list = await api(`/announcements?${q}&start_date=${start}&end_date=${new Date(Date.now() + DAY).toISOString()}&per_page=50`, true);
        return list.slice(0, 40).map((x) => ({
          course: courseNames.get(String(x.context_code || '').replace('course_', '')) || x.context_code,
          title: x.title,
          author: x.author && x.author.display_name,
          posted_at: x.posted_at,
          message: clip(htmlToText(x.message), 1500),
          url: rel(x.html_url),
        }));
      },
    },
    {
      name: 'list_modules',
      label: 'Looking through modules',
      description: 'The modules of a course and what is in each (pages, files, assignments, quizzes, links). Instructions and lecture material often live here.',
      parameters: obj({ course_id: ID }, ['course_id']),
      run: async ({ course_id }) => {
        const mods = await api(`/courses/${course_id}/modules?include[]=items&per_page=50`, true);
        for (const m of mods) if (!m.items && m.items_url) m.items = await api(`${m.items_url}${m.items_url.includes('?') ? '&' : '?'}per_page=100`, true).catch(() => []);
        return mods.map((m) => ({
          module: m.name,
          items: (m.items || []).map((i) => ({
            title: i.title,
            type: i.type,
            file_id: i.type === 'File' ? i.content_id : undefined,
            assignment_id: i.type === 'Assignment' ? i.content_id : undefined,
            discussion_id: i.type === 'Discussion' ? i.content_id : undefined,
            quiz_id: i.type === 'Quiz' ? i.content_id : undefined,
            page_url: i.page_url,
            external_url: i.external_url,
            url: i.type === 'File' ? `/courses/${course_id}/files/${i.content_id}` : rel(i.html_url),
          })),
        }));
      },
    },
    {
      name: 'list_files',
      label: 'Looking through files',
      description: "A course's files with folder, size and date, newest first. If the Files tab is hidden, falls back to files posted in modules. read_file opens any of them.",
      parameters: obj(
        {
          course_id: ID,
          search: { type: 'string', description: 'Optional part of a file name (2+ letters)' },
          folder: { type: 'string', description: 'Optional part of a folder name' },
        },
        ['course_id'],
      ),
      run: async ({ course_id, search, folder }) => {
        try {
          const q = search && search.trim().length >= 2 ? '&search_term=' + encodeURIComponent(search.trim()) : '';
          const [list, folders] = await Promise.all([
            api(`/courses/${course_id}/files?per_page=100&sort=updated_at&order=desc${q}`, true),
            api(`/courses/${course_id}/folders?per_page=100`, true).catch(() => []),
          ]);
          const where = new Map(folders.map((f) => [f.id, String(f.full_name || f.name || '').replace(/^course files\/?/, '') || '(top)']));
          let out = list.map((f) => ({
            file_id: f.id,
            name: f.display_name,
            folder: where.get(f.folder_id),
            size_kb: Math.round((f.size || 0) / 1024),
            updated_at: f.updated_at,
            locked: f.locked_for_user || undefined,
            url: `/courses/${course_id}/files/${f.id}`,
          }));
          if (folder) out = out.filter((f) => String(f.folder || '').toLowerCase().includes(folder.toLowerCase()));
          return out.length > 200 ? { note: `${out.length} files; showing the 200 newest. Narrow with search or folder.`, files: out.slice(0, 200) } : out;
        } catch (e) {
          if (![401, 403, 404].includes(e.status)) throw e;
          const mods = await api(`/courses/${course_id}/modules?include[]=items&per_page=50`, true);
          let out = [];
          for (const m of mods)
            for (const i of m.items || []) if (i.type === 'File') out.push({ file_id: i.content_id, name: i.title, module: m.name, url: `/courses/${course_id}/files/${i.content_id}` });
          if (search) out = out.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
          return { note: 'The Files tab is hidden for students, so these are the files posted in modules.', files: out };
        }
      },
    },
    {
      name: 'read_file',
      label: 'Reading the file',
      description: 'Open a Canvas file by id and read its contents. PDFs and images are attached for you to read; Word and PowerPoint come back as text.',
      parameters: obj({ file_id: ID, course_id: { ...ID, description: 'Optional, for the link' } }, ['file_id']),
      run: async ({ file_id, course_id }) => {
        const f = await api(`/files/${file_id}`);
        const out = {
          name: f.display_name,
          content_type: f['content-type'],
          size_kb: Math.round((f.size || 0) / 1024),
          url: course_id ? `/courses/${course_id}/files/${file_id}` : `/files/${file_id}`,
        };
        if (f.locked_for_user || !f.url) return { ...out, note: 'This file is locked or has no download link.' };
        return { __attach: { url: f.url, name: f.display_name, mime: f['content-type'], size: f.size }, ...out };
      },
    },
    {
      name: 'list_quizzes',
      label: 'Looking through quizzes',
      description: "Every quiz in a course (classic and New Quizzes): due and lock dates, time limit, attempts, points, and whether Saif finished it and his score.",
      parameters: obj({ course_id: ID }, ['course_id']),
      run: async ({ course_id }) => {
        const [classic, assigns] = await Promise.all([
          api(`/courses/${course_id}/quizzes?per_page=100`, true).catch((e) => {
            if ([401, 403, 404].includes(e.status)) return null;
            throw e;
          }),
          api(`/courses/${course_id}/assignments?include[]=submission&per_page=100`, true),
        ]);
        const byId = new Map(assigns.map((a) => [a.id, a]));
        const mine = (a) => {
          const s = (a && a.submission) || {};
          return a ? { finished: !!s.submitted_at, score: s.score ?? undefined } : {};
        };
        const out = (classic || []).map((z) => ({
          title: z.title,
          due_at: z.due_at,
          lock_at: z.lock_at,
          time_limit_minutes: z.time_limit,
          allowed_attempts: z.allowed_attempts,
          questions: z.question_count,
          points: z.points_possible,
          locked: z.locked_for_user || undefined,
          url: rel(z.html_url),
          ...mine(byId.get(z.assignment_id)),
        }));
        const listed = new Set((classic || []).map((z) => z.assignment_id).filter(Boolean));
        for (const a of assigns) {
          if (listed.has(a.id) || !(a.is_quiz_lti_assignment || (a.is_quiz_assignment && a.quiz_id))) continue;
          out.push({ title: a.name, kind: a.is_quiz_lti_assignment ? 'New Quiz' : 'classic', due_at: a.due_at, lock_at: a.lock_at, points: a.points_possible, url: rel(a.html_url), ...mine(a) });
        }
        return out;
      },
    },
    {
      name: 'list_discussions',
      label: 'Looking through discussions',
      description: "A course's Canvas discussions: topics with reply and unread counts and due dates for graded ones.",
      parameters: obj({ course_id: ID, search: { type: 'string', description: 'Optional words in titles' } }, ['course_id']),
      run: async ({ course_id, search }) => {
        const q = search ? '&search_term=' + encodeURIComponent(search) : '';
        const list = await api(`/courses/${course_id}/discussion_topics?per_page=100&order_by=recent_activity${q}`, true);
        return list.slice(0, 80).map((t) => ({
          id: t.id,
          title: t.title,
          author: (t.author && t.author.display_name) || t.user_name,
          posted_at: t.posted_at,
          replies: t.discussion_subentry_count,
          unread: t.unread_count,
          due_at: (t.assignment && t.assignment.due_at) || t.todo_date || undefined,
          must_post_first: !!t.require_initial_post || undefined,
          preview: clip(htmlToText(t.message), 300),
          url: rel(t.html_url),
        }));
      },
    },
    {
      name: 'get_discussion',
      label: 'Reading the discussion',
      description: 'Read one Canvas discussion: the prompt and replies, threaded.',
      parameters: obj({ course_id: ID, discussion_id: ID }, ['course_id', 'discussion_id']),
      run: async ({ course_id, discussion_id }) => {
        const t = await api(`/courses/${course_id}/discussion_topics/${discussion_id}`);
        const out = {
          title: t.title,
          author: (t.author && t.author.display_name) || t.user_name,
          posted_at: t.posted_at,
          prompt: clip(htmlToText(t.message), 8000),
          linked_file_ids: fileIdsIn(t.message),
          url: rel(t.html_url),
        };
        try {
          const view = await api(`/courses/${course_id}/discussion_topics/${discussion_id}/view`);
          const who = new Map((view.participants || []).map((p) => [p.id, p.display_name]));
          const lines = [];
          let budget = 16000;
          const walk = (list, depth) => {
            for (const e of list || []) {
              if (budget <= 0) return;
              const line = `${'  '.repeat(depth)}- ${who.get(e.user_id) || 'Someone'} (${(e.created_at || '').slice(0, 10)}): ${e.deleted ? '(deleted)' : htmlToText(e.message)}`;
              lines.push(line);
              budget -= line.length;
              walk(e.replies, depth + 1);
            }
          };
          walk(view.view, 0);
          out.replies = lines.join('\n') || '(no replies yet)';
        } catch (e) {
          out.replies = e.status === 403 ? 'Hidden until Saif posts his own reply.' : 'Replies not available.';
        }
        return out;
      },
    },
    {
      name: 'list_pages',
      label: 'Looking through pages',
      description: "A course's pages with their page_url, newest first. Read one with get_page.",
      parameters: obj({ course_id: ID, search: { type: 'string', description: 'Optional words in titles' } }, ['course_id']),
      run: async ({ course_id, search }) => {
        const q = search ? '&search_term=' + encodeURIComponent(search) : '';
        const list = await api(`/courses/${course_id}/pages?per_page=100&sort=updated_at&order=desc${q}`, true);
        return list.slice(0, 150).map((p) => ({ title: p.title, page_url: p.url, updated_at: p.updated_at, url: rel(p.html_url) }));
      },
    },
    {
      name: 'get_page',
      label: 'Reading the page',
      description: 'Read a course page by page_url (from list_pages or list_modules). Use "front_page" for the course home page.',
      parameters: obj({ course_id: ID, page_url: { type: 'string' } }, ['course_id', 'page_url']),
      run: async ({ course_id, page_url }) => {
        const p = await api(page_url === 'front_page' ? `/courses/${course_id}/front_page` : `/courses/${course_id}/pages/${encodeURIComponent(page_url)}`);
        return { title: p.title, body: clip(htmlToText(p.body)), linked_file_ids: fileIdsIn(p.body), updated_at: p.updated_at, url: rel(p.html_url) };
      },
    },
    {
      name: 'get_syllabus',
      label: 'Reading the syllabus',
      description: 'The syllabus of a course. If it is empty, the syllabus is often a file (try list_files with search "syllabus") or a page.',
      parameters: obj({ course_id: ID }, ['course_id']),
      run: async ({ course_id }) => {
        const c = await api(`/courses/${course_id}?include[]=syllabus_body`);
        return { course: c.name, syllabus: clip(htmlToText(c.syllabus_body)) || '(empty)', linked_file_ids: fileIdsIn(c.syllabus_body), url: `/courses/${course_id}/assignments/syllabus` };
      },
    },
    {
      name: 'list_people',
      label: 'Looking up people',
      description: 'People in a course. Default: instructors and TAs. Pass role "student" with a search to find a classmate.',
      parameters: obj(
        {
          course_id: ID,
          role: { type: 'string', enum: ['staff', 'student', 'all'] },
          search: { type: 'string', description: 'Optional part of a name' },
        },
        ['course_id'],
      ),
      run: async ({ course_id, role = 'staff', search }) => {
        const types = { staff: ['teacher', 'ta'], student: ['student'], all: [] }[role] || ['teacher', 'ta'];
        const q = types.map((t) => '&enrollment_type[]=' + t).join('') + (search && search.length >= 2 ? '&search_term=' + encodeURIComponent(search) : '');
        const list = await api(`/courses/${course_id}/users?per_page=100&include[]=enrollments&include[]=email${q}`, true);
        const ROLE = { TeacherEnrollment: 'teacher', TaEnrollment: 'TA', StudentEnrollment: 'student' };
        return list.slice(0, 150).map((u) => ({
          name: u.name,
          pronouns: u.pronouns || undefined,
          email: u.email || undefined,
          roles: [...new Set((u.enrollments || []).map((e) => ROLE[e.type] || e.role || e.type))],
          message_url: `/conversations?user_id=${u.id}&user_name=${encodeURIComponent(u.name)}&context_id=course_${course_id}`,
        }));
      },
    },
    {
      name: 'list_tabs',
      label: 'Checking course tools',
      description: "The tools in a course's menu (Syllabus, Zoom, Gradescope, Ed, NameCoach…) with links.",
      parameters: obj({ course_id: ID }, ['course_id']),
      run: async ({ course_id }) => (await api(`/courses/${course_id}/tabs?per_page=100`, true)).map((t) => ({ label: t.label, external: t.type === 'external' || undefined, url: rel(t.html_url) })),
    },
    {
      name: 'list_inbox',
      label: 'Checking your inbox',
      description: "Saif's Canvas Inbox: recent conversations with subject, people, course, last message, unread.",
      parameters: obj({ scope: { type: 'string', enum: ['inbox', 'unread', 'sent', 'starred', 'archived'] } }),
      run: async ({ scope = 'inbox' }) =>
        (await api(`/conversations?per_page=30&scope=${encodeURIComponent(scope)}`)).map((c) => ({
          id: c.id,
          subject: c.subject || '(no subject)',
          course: c.context_name,
          with: (c.participants || []).map((p) => p.name).join(', '),
          unread: c.workflow_state === 'unread',
          last_at: c.last_message_at,
          last_message: clip(c.last_message || '', 300),
          url: `/conversations#filter=type=inbox`,
        })),
    },
    {
      name: 'get_conversation',
      label: 'Reading the message',
      description: 'Read one Inbox conversation in full, oldest first. Does not mark it read.',
      parameters: obj({ conversation_id: ID }, ['conversation_id']),
      run: async ({ conversation_id }) => {
        const c = await api(`/conversations/${conversation_id}?auto_mark_as_read=false`);
        const who = new Map((c.participants || []).map((p) => [p.id, p.name]));
        return {
          subject: c.subject,
          course: c.context_name,
          messages: (c.messages || [])
            .slice()
            .reverse()
            .map((m) => ({ from: who.get(m.author_id) || 'Someone', at: m.created_at, text: clip(m.body || '', 4000), attachments: (m.attachments || []).map((a) => ({ file_id: a.id, name: a.display_name })) })),
        };
      },
    },
  ];
  const TOOL_BY = new Map(TOOLS.map((t) => [t.name, t]));
  const TOOL_DEFS = TOOLS.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters, strict: false }));

  async function runTool(call) {
    const t = TOOL_BY.get(call.name);
    if (!t) return { call_id: call.call_id, output: JSON.stringify({ error: `Unknown tool ${call.name}` }) };
    let args = {};
    try {
      args = JSON.parse(call.arguments || '{}');
    } catch {}
    // Arguments come from the model, which may have read text written by anyone (posts, files),
    // so ids must be plain numbers and enums must be one of their values before they reach a URL.
    const props = (t.parameters && t.parameters.properties) || {};
    for (const [k, v] of Object.entries(args || {})) {
      if (v == null || v === '') continue;
      if (/(^|_)id$/.test(k) && !/^\d+$/.test(String(v)))
        return { call_id: call.call_id, output: JSON.stringify({ error: `${k} must be a numeric Canvas id` }) };
      if (props[k] && props[k].enum && !props[k].enum.includes(v))
        return { call_id: call.call_id, output: JSON.stringify({ error: `${k} must be one of ${props[k].enum.join(', ')}` }) };
    }
    try {
      const res = await t.run(args);
      let attach = null;
      if (res && res.__attach) {
        attach = res.__attach;
        delete res.__attach;
      }
      let output = JSON.stringify(res ?? null);
      if (output.length > MAX_OUT) output = JSON.stringify({ truncated: true, partial: output.slice(0, MAX_OUT) });
      return { call_id: call.call_id, output, attach };
    } catch (e) {
      return { call_id: call.call_id, output: JSON.stringify({ error: String((e && e.message) || e) }) };
    }
  }

  async function instructions() {
    const me = (gcx.getMe && gcx.getMe()) || {};
    const list = await courses().catch(() => []);
    const now = new Date();
    const when = now.toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return [
      `You are the assistant built into ${me.name || 'the student'}'s Canvas (his school's LMS, ${location.origin}). Now: ${when} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`,
      `His current courses (id · name · code · instructors · grade):`,
      ...list.map((c) => `- ${c.id} · ${c.name} · ${c.code || ''} · ${c.teachers.join(', ') || '?'} · ${c.grade || 'no grade shown'}`),
      '',
      'How to answer:',
      '- Look things up with the tools; never guess due dates, grades, scores or what a file or page says. Several tool calls are fine.',
      "- The reply appears in a small overlay about 420px wide. Lead with the answer. Keep it short: a sentence or a few bullets, no preamble, no closing offers. No tables wider than 3 columns.",
      '- Link Canvas items with markdown links using the url fields from the tools (relative /courses/... links are fine), e.g. [Exam 2](/courses/1/assignments/2).',
      '- Give dates in his local time like "Wed, Oct 28 at 1:00 PM", and say "today"/"tomorrow" when that applies.',
      '- You can only read. You cannot submit, post, message, or change anything; say so if asked, and link the page where he can do it.',
      '- If a tool fails or something is hidden by the instructor, say what you could not get.',
    ].join('\n');
  }

  // ---------------------------------------------------------------- markdown (escape first, then rebuild a few tags)
  const mdEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeHref = (h) => {
    const raw = h.replace(/&amp;/g, '&');
    if (/^\/(?!\/)/.test(raw)) return location.origin + raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    return null;
  };
  const linkTag = (href, text) => {
    const u = safeHref(href);
    if (!u) return text;
    const ext = !u.startsWith(location.origin);
    return `<a href="${mdEsc(u)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
  };
  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => {
      codes.push(c);
      return '\u0000' + (codes.length - 1) + '\u0000';
    });
    const links = [];
    s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, (_, t, h) => {
      links.push(linkTag(h, t));
      return '\u0001' + (links.length - 1) + '\u0001';
    });
    s = s
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, (_, pre, u) => {
        links.push(linkTag(u, u));
        return pre + '\u0001' + (links.length - 1) + '\u0001';
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
      .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
    return s.replace(/\u0001(\d+)\u0001/g, (_, i) => links[+i]).replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codes[+i] + '</code>');
  }
  const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
  const cells = (l) =>
    l
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => inline(c.trim()));
  function md(src) {
    const lines = mdEsc(String(src || ''))
      .replace(/\r/g, '')
      .split('\n');
    const listRe = /^(\s*)([-*+•]|\d+[.)])\s+(.*)$/;
    const out = [];
    let i = 0;
    const list = () => {
      const first = lines[i].match(listRe);
      const indent = first[1].length;
      const ordered = /\d/.test(first[2]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(listRe);
        if (m && m[1].length === indent && /\d/.test(m[2]) === ordered) {
          items.push({ text: [m[3]], sub: [] });
          i++;
        } else if (m && m[1].length > indent && items.length) items[items.length - 1].sub.push(list());
        else if (!m && lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) items[items.length - 1].text.push(lines[i++].trim());
        else break;
      }
      const tag = ordered ? 'ol' : 'ul';
      return `<${tag}>` + items.map((it) => '<li>' + it.text.map(inline).join('<br>') + it.sub.join('') + '</li>').join('') + `</${tag}>`;
    };
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*```/.test(l)) {
        const body = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
        i++;
        out.push('<pre><code>' + body.join('\n') + '</code></pre>');
        continue;
      }
      if (!l.trim()) {
        i++;
        continue;
      }
      const h = l.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        out.push(`<p class="gcx-ask-h">${inline(h[2])}</p>`);
        i++;
        continue;
      }
      if (l.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const head = cells(l);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
        out.push(
          '<div class="gcx-ask-tbl"><table><thead><tr>' +
            head.map((c) => `<th>${c}</th>`).join('') +
            '</tr></thead><tbody>' +
            rows.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') +
            '</tbody></table></div>',
        );
        continue;
      }
      if (listRe.test(l)) {
        out.push(list());
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^\s*```/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !listRe.test(lines[i])) para.push(lines[i++]);
      out.push('<p>' + para.map(inline).join('<br>') + '</p>');
    }
    return out.join('');
  }

  // ---------------------------------------------------------------- history (per tab)
  const HKEY = 'gcx:ask';
  const loadHist = () => {
    try {
      return JSON.parse(sessionStorage.getItem(HKEY)) || { msgs: [], prev: null };
    } catch {
      return { msgs: [], prev: null };
    }
  };
  const saveHist = () => {
    try {
      sessionStorage.setItem(HKEY, JSON.stringify(hist));
    } catch {}
  };
  let hist = loadHist();

  // ---------------------------------------------------------------- UI
  const STAR = 'M12 1.5c.4 0 .73.28.8.67.86 4.67 4.36 8.17 9.03 9.03a.81.81 0 0 1 0 1.6c-4.67.86-8.17 4.36-9.03 9.03a.81.81 0 0 1-1.6 0c-.86-4.67-4.36-8.17-9.03-9.03a.81.81 0 0 1 0-1.6C6.84 10.34 10.34 6.84 11.2 2.17c.07-.39.4-.67.8-.67z';
  const ICON = {
    send: 'M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z',
    stop: 'M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
    plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  };
  const icon = (d, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${d}"/></svg>`;
  const HINT = 'Ask anything…';
  const SUGGEST = ["What's due this week?", 'How are my grades looking?', 'Summarize the latest announcements', "What's on my next exam?"];
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mountAsk(slot) {
    if (!slot || slot.querySelector('.gcx-ask')) return;
    const gid = 'gcx-ask-g' + Math.random().toString(36).slice(2, 7);
    const root = gcx.el(`<div class="gcx-ask" data-state="idle">
      <div class="gcx-ask-pill" role="button" tabindex="0" aria-label="Ask anything about your classes" aria-expanded="false">
        <span class="gcx-ask-star"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset=".55" stop-color="#9b72f2"/><stop offset="1" stop-color="#e46fa8"/></linearGradient></defs><path fill="url(#${gid})" d="${STAR}"/></svg></span>
        <span class="gcx-ask-hint" aria-hidden="true"></span>
        <input class="gcx-ask-input" type="text" autocomplete="off" spellcheck="false" placeholder="Ask about your classes" aria-label="Ask about your classes" tabindex="-1">
        <button class="gcx-ask-send" type="button" tabindex="-1" aria-label="Send">${icon(ICON.send, 18)}</button>
      </div>
      <div class="gcx-ask-chat" aria-live="polite">
        <div class="gcx-ask-top"><span>Ask anything</span><button class="gcx-ask-new" type="button" title="Start a new chat">${icon(ICON.plus, 16)}New chat</button></div>
        <div class="gcx-ask-log"></div>
      </div>
    </div>`);
    slot.append(root);
    const pill = root.querySelector('.gcx-ask-pill');
    const hint = root.querySelector('.gcx-ask-hint');
    const input = root.querySelector('.gcx-ask-input');
    const sendBtn = root.querySelector('.gcx-ask-send');
    const chat = root.querySelector('.gcx-ask-chat');
    const log = root.querySelector('.gcx-ask-log');

    let state = 'idle';
    let busy = false;
    let port = null;
    // The question in flight: stop() marks it cancelled and settles its pending round itself,
    // because disconnecting a port from this side never fires this side's onDisconnect.
    let run = null;
    let typeTimer = 0;
    let leaveTimer = 0;
    let keyMode = false;

    const setState = (s) => {
      if (s === state) return;
      state = s;
      root.dataset.state = s;
      pill.setAttribute('aria-expanded', String(s === 'open'));
      input.tabIndex = sendBtn.tabIndex = s === 'open' ? 0 : -1;
      if (s === 'hover') typeHint();
      else stopTyping();
      if (s === 'open') {
        renderLog();
        requestAnimationFrame(() => {
          if (!root.contains(document.activeElement) || document.activeElement === pill) input.focus({ preventScroll: true });
          log.scrollTop = log.scrollHeight;
        });
      }
      if (s === 'idle' && root.contains(document.activeElement)) document.activeElement.blur();
    };
    function typeHint() {
      stopTyping();
      if (reduced()) {
        hint.textContent = HINT;
        return;
      }
      let n = 0;
      const step = () => {
        hint.textContent = HINT.slice(0, n);
        if (n++ < HINT.length) typeTimer = setTimeout(step, n === 1 ? 260 : 34);
      };
      step();
    }
    function stopTyping() {
      clearTimeout(typeTimer);
      hint.textContent = '';
    }
    const keepOpen = () => busy || (document.activeElement === input && input.value.trim()) || keyMode;

    // Hover in: pill (or straight to the chat if there's history).
    pill.addEventListener('pointerenter', () => {
      clearTimeout(leaveTimer);
      if (state === 'idle') setState(hist.msgs.length ? 'open' : 'hover');
    });
    pill.addEventListener('click', (e) => {
      if (e.target.closest('.gcx-ask-send')) return;
      if (state !== 'open') setState('open');
      else input.focus();
    });
    pill.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === pill) {
        e.preventDefault();
        setState('open');
      }
    });
    root.addEventListener('focusin', () => {
      clearTimeout(leaveTimer);
      if (state !== 'open') setState('open');
    });
    root.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!root.contains(document.activeElement) && !root.matches(':hover') && !keepOpen()) setState('idle');
      }, 0);
    });

    // Leaving the general area (pill + chat + a margin) collapses it, unless he's mid-question.
    const PAD = 56;
    const inside = (x, y) =>
      [pill, state === 'open' ? chat : null].filter(Boolean).some((n) => {
        const r = n.getBoundingClientRect();
        return x >= r.left - PAD && x <= r.right + PAD && y >= r.top - PAD && y <= r.bottom + PAD;
      });
    document.addEventListener(
      'pointermove',
      (e) => {
        if (state === 'idle') return;
        if (inside(e.clientX, e.clientY)) {
          clearTimeout(leaveTimer);
          leaveTimer = 0;
          return;
        }
        if (state === 'hover' && !pill.matches(':hover')) {
          clearTimeout(leaveTimer);
          leaveTimer = setTimeout(() => setState('idle'), 120);
          return;
        }
        if (leaveTimer || keepOpen()) return;
        leaveTimer = setTimeout(() => {
          leaveTimer = 0;
          if (!keepOpen()) setState('idle');
        }, 450);
      },
      { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => {
      if (state !== 'idle' && !keepOpen()) leaveTimer = setTimeout(() => setState('idle'), 450);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state !== 'idle' && (root.contains(document.activeElement) || state === 'open')) {
        if (busy) stop();
        setState('idle');
      }
    });

    // ----- rendering
    function msgHtml(m) {
      if (m.role === 'user') return `<div class="gcx-ask-msg user"><div class="gcx-ask-bubble">${esc(m.text)}</div></div>`;
      return `<div class="gcx-ask-msg bot${m.error ? ' err' : ''}">${m.error ? esc(m.text) : md(m.text)}</div>`;
    }
    function renderLog() {
      if (keyMode) return;
      if (!hist.msgs.length) {
        root.classList.add('empty');
        log.innerHTML = `<div class="gcx-ask-suggest">${SUGGEST.map((s, i) => `<button type="button" style="--i:${i}">${esc(s)}</button>`).join('')}</div>`;
        return;
      }
      root.classList.remove('empty');
      log.innerHTML = hist.msgs.map(msgHtml).join('');
    }
    log.addEventListener('click', (e) => {
      const b = e.target.closest('.gcx-ask-suggest button');
      if (b) ask(b.textContent);
    });
    root.querySelector('.gcx-ask-new').addEventListener('click', () => {
      if (busy) stop();
      if (run) run.discard = true;
      hist = { msgs: [], prev: null };
      saveHist();
      renderLog();
      input.value = '';
      input.focus();
    });

    function setBusy(b) {
      busy = b;
      root.classList.toggle('busy', b);
      sendBtn.innerHTML = icon(b ? ICON.stop : ICON.send, 18);
      sendBtn.setAttribute('aria-label', b ? 'Stop' : 'Send');
    }
    sendBtn.addEventListener('click', () => (busy ? stop() : ask(input.value)));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!busy) ask(input.value);
      }
    });

    // The key is typed into the extension's own options page, never into a field on the Canvas page.
    function showKeyPrompt(msg) {
      keyMode = true;
      root.classList.remove('empty');
      log.innerHTML = `<div class="gcx-ask-msg bot err">${esc(msg)} Add your OpenAI API key on the extension's settings page, then ask again.
        <button type="button" class="gcx-ask-keybtn">Add key</button></div>`;
      log.querySelector('.gcx-ask-keybtn').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'openOptions' }).catch(() => {}));
    }
    function retryAfterKey() {
      keyMode = false;
      const last = hist.msgs[hist.msgs.length - 1];
      if (last && last.error) hist.msgs.pop();
      const q = hist.msgs.length && hist.msgs[hist.msgs.length - 1].role === 'user' ? hist.msgs.pop().text : '';
      saveHist();
      renderLog();
      if (q) ask(q);
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.openaiKey && changes.openaiKey.newValue && keyMode) {
        gcx.toast && gcx.toast('Key saved');
        retryAfterKey();
      }
    });

    // ----- one question: stream, run tools, repeat
    function stop() {
      if (run) {
        run.cancelled = true;
        if (run.resolve) run.resolve({ type: 'stopped' });
      }
      if (port) {
        try {
          port.disconnect();
        } catch {}
        port = null;
      }
    }
    async function ask(q) {
      q = String(q || '').trim();
      if (!q || busy) return;
      // A pasted API key must never become chat text (history, or a message to OpenAI).
      if (/^sk-[\w-]{10,}/.test(q)) {
        input.value = '';
        showKeyPrompt("Keys don't go in the chat.");
        return;
      }
      keyMode = false;
      // Created first so Stop / New chat work even while the course list is still loading.
      const me = (run = { cancelled: false, discard: false, resolve: null });
      input.value = '';
      setState('open');
      hist.msgs.push({ role: 'user', text: q });
      saveHist();
      renderLog();
      const bot = gcx.el(`<div class="gcx-ask-msg bot live"><div class="gcx-ask-status"><span class="gcx-ask-dot"></span><span>Thinking</span></div></div>`);
      log.append(bot);
      const statusEl = bot.querySelector('.gcx-ask-status span:last-child');
      const scroll = () => {
        if (log.scrollHeight - log.scrollTop - log.clientHeight < 120) log.scrollTop = log.scrollHeight;
      };
      log.scrollTop = log.scrollHeight;
      setBusy(true);

      let text = '';
      let raf = 0;
      const paint = () => {
        raf = 0;
        bot.innerHTML = md(text) + (busy ? '<span class="gcx-ask-caret"></span>' : '');
        scroll();
      };
      const status = (s) => {
        if (text) {
          // Text came before a tool call: keep it and show the status under it.
          bot.innerHTML = md(text) + `<div class="gcx-ask-status"><span class="gcx-ask-dot"></span><span>${esc(s)}</span></div>`;
        } else statusEl.textContent = s;
        scroll();
      };

      const instr = await instructions();
      if (me.cancelled && !text) text = '_Stopped._';
      const history = hist.msgs.slice(-12, -1).filter((m) => !m.error).map((m) => ({ role: m.role, content: m.text }));
      let req = hist.prev
        ? { type: 'start', instructions: instr, tools: TOOL_DEFS, previous_response_id: hist.prev, input: [{ role: 'user', content: q }] }
        : { type: 'start', instructions: instr, tools: TOOL_DEFS, input: [...history, { role: 'user', content: q }] };

      let finalId = null;
      let error = null;
      for (let round = 0; round < MAX_ROUNDS; round++) {
        if (me.cancelled) {
          if (!text) text = '_Stopped._';
          break;
        }
        const res = await new Promise((resolve) => {
          me.resolve = resolve;
          try {
            port = chrome.runtime.connect({ name: 'gcx-ask' });
          } catch (e) {
            return resolve({ type: 'error', code: 'ext', message: 'The extension was reloaded. Refresh the page.' });
          }
          port.onMessage.addListener((m) => {
            if (m.type === 'delta') {
              text += m.text;
              if (!raf) raf = requestAnimationFrame(paint);
            } else if (m.type === 'tool_start') status((TOOL_BY.get(m.name) || {}).label || 'Looking things up');
            else resolve(m);
          });
          port.onDisconnect.addListener(() => resolve({ type: 'stopped' }));
          port.postMessage(req);
        });
        me.resolve = null;
        const p = port;
        port = null;
        try {
          p && p.disconnect();
        } catch {}
        if (res.type === 'error' && res.code === 'noprev' && req.previous_response_id && round === 0) {
          hist.prev = null;
          req = { type: 'start', instructions: instr, tools: TOOL_DEFS, input: [...history, { role: 'user', content: q }] };
          round--;
          continue;
        }
        if (res.type === 'error') {
          error = res;
          break;
        }
        if (res.type === 'stopped') {
          if (!text) text = '_Stopped._';
          break;
        }
        if (res.type === 'done') {
          finalId = res.response_id;
          break;
        }
        // tool_calls
        if (text && !/\n$/.test(text)) text += '\n\n';
        const outputs = await Promise.all(res.calls.map(runTool));
        status('Thinking');
        req = { type: 'continue', instructions: instr, tools: TOOL_DEFS, previous_response_id: res.response_id, outputs };
      }
      cancelAnimationFrame(raf);
      if (run === me) run = null;
      setBusy(false);
      bot.classList.remove('live');
      // "New chat" was pressed mid-answer: drop this answer instead of writing it into the new chat.
      if (me.discard) {
        bot.remove();
        return;
      }
      if (error) {
        bot.remove();
        if (error.code === 'nokey' || error.code === 'badkey') {
          hist.msgs.push({ role: 'assistant', text: error.code === 'nokey' ? 'No OpenAI key yet.' : 'OpenAI rejected the key.', error: true });
          saveHist();
          showKeyPrompt(error.code === 'nokey' ? 'No OpenAI key yet.' : 'OpenAI rejected that key.');
          return;
        }
        hist.msgs.push({ role: 'assistant', text: `Couldn't answer: ${error.message}`, error: true });
      } else {
        hist.msgs.push({ role: 'assistant', text: text || '(no answer)' });
        if (finalId) hist.prev = finalId;
      }
      saveHist();
      renderLog();
      log.scrollTop = log.scrollHeight;
      if (state === 'open' && document.activeElement !== input && root.matches(':hover')) input.focus({ preventScroll: true });
    }

    renderLog();
    return root;
  }
  gcx.mountAsk = mountAsk;

  // The dashboard's welcome row has a slot for it (classroom.js adds it).
  const slot = document.querySelector('.gcx-ask-slot');
  if (slot) mountAsk(slot);
  else if (gcx.VIEW === '' && location.pathname === '/') {
    const mo = new MutationObserver(() => {
      const s = document.querySelector('.gcx-ask-slot');
      if (s) {
        mo.disconnect();
        mountAsk(s);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 15000);
  }
})();
