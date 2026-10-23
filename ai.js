// "Ask anything": a frosted "AI" button on the dashboard (and a Ctrl+Space chat on any page) that
// opens into a small chat about his classes.
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

  // Modules with their items. Canvas leaves `items` out of big modules and gives `items_url` instead.
  async function modulesWithItems(courseId) {
    const mods = await api(`/courses/${courseId}/modules?include[]=items&per_page=50`, true);
    await Promise.all(
      mods
        .filter((m) => !m.items && m.items_url)
        .map(async (m) => {
          m.items = await api(`${m.items_url}${m.items_url.includes('?') ? '&' : '?'}per_page=100`, true).catch(() => []);
        }),
    );
    return mods;
  }

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
        const mods = await modulesWithItems(course_id);
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
          const mods = await modulesWithItems(course_id);
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
      name: 'open_page',
      label: 'Opening the page',
      description:
        "Take Saif to a Canvas page in this tab when he asks to go to / open / take him to something (a course's grades, an assignment, Classwork, a file, the To-do). Use a url from the other tools or a known Canvas path like /courses/123/grades, /courses/123/modules, /?gcx=todo. It opens once your reply finishes.",
      parameters: obj({ url: { type: 'string' }, label: { type: 'string', description: 'Short name of the page, e.g. "Genetics grades"' } }, ['url']),
      run: async ({ url, label }) => {
        let u;
        try {
          u = new URL(String(url), location.origin);
        } catch {
          return { error: 'Not a valid address' };
        }
        if (u.origin !== location.origin || u.pathname.startsWith('//')) return { error: 'Only Canvas pages on this site can be opened' };
        navRequest = { url: u.href, label: String(label || 'that page').slice(0, 60) };
        return { ok: true, note: 'It opens after your reply; keep the reply to one short line.' };
      },
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

  // Model routing: short, factual lookups go to the small model; anything that needs reading,
  // explaining, planning or writing goes to the full one. Settings can turn this off.
  // Only clear, short lookups ("when is HW 8 due?", "any unread messages?", "take me to my
  // grades") go to the small model; anything else, and short follow-ups to a full-model turn,
  // goes to the full one.
  const QUICK = /^(?:(?:when|what time|where)\b|(?:what(?:'s| is)) (?:due|my (?:next|latest))\b|is (?:there|it|.+) due\b|(?:due|deadline)s?\b|(?:do i have|any) (?:new |unread )?(?:messages?|announcements?|inbox)|(?:open|go to|take me|bring me|show me)\b|(?:link|url) (?:to|for)\b|how many (?:unread|messages|assignments are due))/i;
  const DEEP = /\b(summar|explain|why|how (?:do|does|did|should|can|would|much)|compare|analy[sz]|plan|study|strateg|quiz me|practice|write|draft|essay|feedback|improve|understand|mean|read|pdf|slides?|lecture|notes?|file|syllabus|rubric|calculat|need|grade|points?|score|pass|predict|help|advice|should i|teach|walk me|step|topics?|exam|midterm|final|cover|requirement|prompt|break down|go over|problem)/i;
  let lastTier = 'smart';
  const routeTier = (q) => {
    if (gcx.prefs().routing === false) return 'smart';
    const followUp = q.length < 40 && /^(and|what about|how about|also|ok|okay|same|now|then)\b|\?$/i.test(q) && !QUICK.test(q);
    if (followUp && lastTier === 'smart') return 'smart';
    return q.length <= 90 && QUICK.test(q) && !DEEP.test(q) ? 'fast' : 'smart';
  };
  // Tools that read course content: once one has run, the rest of the answer uses the full model.
  const READING = new Set(['read_file', 'get_page', 'get_syllabus', 'get_discussion', 'get_assignment', 'get_grades', 'get_feedback', 'list_announcements']);
  // Set by the open_page tool; followed once the answer has finished.
  let navRequest = null;
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
      '- If he asks to go to, open or be taken to a page, find its URL (with the tools if needed) and call open_page, then reply in one short line like "Opening your Genetics grades." Only do this when he asks.',
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
  const ICON = {
    send: 'M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z', // the Enter key
    stop: 'M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
    plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  };
  const icon = (d, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${d}"/></svg>`;
  const SUGGEST = ["What's due this week?", 'How are my grades looking?', 'Summarize the latest announcements', "What's on my next exam?"];
  const OPEN_W = 'min(440px, calc(100vw - 160px))';
  const HOVER_W = 200;
  const ROW = 48; // height of the input row, and of the closed circle
  const SPOT_ROW = 56; // the Ctrl+Space pill is taller
  // One answer at a time across the dashboard pill and the Ctrl+Space panel (they share history).
  let asking = null;

  // Plain text of the start of an answer, for the little preview next to the closed circle.
  const previewText = (t) =>
    String(t || '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s*(?:[-*+•]|\d+\.)\s+/gm, '')
      .replace(/[*_`#>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  // opts.spot: the floating Ctrl+Space variant. It opens as a wide input pill ("compact"), grows
  // into the chat on the first question, never closes on pointer-leave, and calls opts.onClose
  // (X button, Esc) and opts.onAsk (first question) so its controller can drop the backdrop.
  function mountAsk(slot, opts = {}) {
    if (!slot || slot.querySelector('.gcx-ask')) return null;
    const spot = !!opts.spot;
    const rowH = spot ? SPOT_ROW : ROW;
    // Everything this pill listens to on the page goes away with it (prefs can turn it off).
    const ac = new AbortController();
    const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal: ac.signal });

    const root = gcx.el(`<div class="gcx-ask${spot ? ' spot compact' : ''}" data-state="idle"${spot ? ' role="dialog" aria-label="Ask anything"' : ''}>
      <div class="gcx-ask-box">
        ${spot ? '<span class="gcx-ask-grip" title="Drag to move" aria-hidden="true"></span>' : ''}
        <div class="gcx-ask-top"><button class="gcx-ask-new" type="button" title="Start a new chat" tabindex="-1">${icon(ICON.plus, 16)}New chat</button></div>
        <div class="gcx-ask-log"></div>
        <div class="gcx-ask-row" role="button" tabindex="0" aria-label="Ask anything about your classes" aria-expanded="false">
          <span class="gcx-ask-hint" aria-hidden="true">Ask anything…</span>
          <input class="gcx-ask-input" type="text" autocomplete="off" spellcheck="false" placeholder="${spot ? 'Ask anything…' : 'Ask about your classes'}" aria-label="Ask about your classes" tabindex="-1">
          <button class="gcx-ask-send" type="button" tabindex="-1" aria-label="Send">${icon(ICON.send, 16)}</button>
        </div>
        <span class="gcx-ask-icon"><span class="gcx-ask-ai">AI</span></span>
      </div>
      ${spot ? `<button class="gcx-ask-x" type="button" title="Close" aria-label="Close">${icon(ICON.close, 14)}</button>` : ''}
      <div class="gcx-ask-peek" aria-hidden="true"><span class="gcx-ask-pdot"></span><span class="gcx-ask-ptext"></span></div>
      <div class="gcx-ask-sr" role="status"></div>
    </div>`);
    slot.append(root);
    const box = root.querySelector('.gcx-ask-box');
    const row = root.querySelector('.gcx-ask-row');
    const input = root.querySelector('.gcx-ask-input');
    const sendBtn = root.querySelector('.gcx-ask-send');
    const newBtn = root.querySelector('.gcx-ask-new');
    const top = root.querySelector('.gcx-ask-top');
    const log = root.querySelector('.gcx-ask-log');
    const peek = root.querySelector('.gcx-ask-peek');
    const peekText = root.querySelector('.gcx-ask-ptext');
    // Screen readers get short status lines and the finished answer here, not every streamed word.
    const srBox = root.querySelector('.gcx-ask-sr');
    const announce = (t) => {
      srBox.textContent = '';
      setTimeout(() => (srBox.textContent = t), 30);
    };

    let state = 'idle';
    let busy = false;
    let port = null;
    // The question in flight: stop() marks it cancelled and settles its pending round itself,
    // because disconnecting a port from this side never fires this side's onDisconnect.
    let run = null;
    let leaveTimer = 0;
    let keyMode = false;
    let unseen = false; // an answer finished while the chat was closed
    let live = ''; // what the preview shows while an answer is in progress

    // Size: the box grows left (width) and down (height) from the closed circle. Height is
    // measured from the content so it can animate; the log scrolls past a cap.
    const maxH = () => (spot ? Math.min(Math.round(innerHeight * 0.72), 620) : Math.min(Math.round(innerHeight * 0.62), 560));
    function fit() {
      if (spot) {
        // The floating panel's width comes from its holder; only the height moves.
        if (root.classList.contains('compact')) {
          box.style.height = rowH + 'px';
          return;
        }
      } else if (state === 'idle') {
        box.style.width = box.style.height = '';
        return;
      }
      if (state === 'hover') {
        box.style.width = HOVER_W + 'px';
        box.style.height = ROW + 'px';
        return;
      }
      if (!spot) box.style.width = OPEN_W;
      // Measure the messages themselves; the log's scrollHeight never drops below its current box.
      const kids = log.children;
      const cs = getComputedStyle(log);
      const content = kids.length
        ? kids[kids.length - 1].getBoundingClientRect().bottom - kids[0].getBoundingClientRect().top + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
        : 0;
      const want = top.offsetHeight + content + rowH + 2;
      box.style.height = Math.min(maxH(), Math.max(rowH + 120, want)) + 'px';
    }
    const ro = new ResizeObserver(() => state === 'open' && fit());
    ro.observe(log);

    const setState = (s) => {
      if (s === state) return;
      state = s;
      root.dataset.state = s;
      row.setAttribute('aria-expanded', String(s === 'open'));
      input.tabIndex = sendBtn.tabIndex = newBtn.tabIndex = s === 'open' ? 0 : -1;
      if (s === 'open') {
        unseen = false;
        renderLog();
        fit();
        requestAnimationFrame(() => {
          fit();
          if (!root.contains(document.activeElement) || document.activeElement === row) input.focus({ preventScroll: true });
          log.scrollTop = log.scrollHeight;
        });
      } else fit();
      if (s === 'idle' && root.contains(document.activeElement)) document.activeElement.blur();
      updatePeek();
    };

    // The little preview beside the closed circle: what's happening, or the start of the answer.
    function updatePeek() {
      const show = state === 'idle' && (busy || unseen) && !!live;
      if (show) peekText.textContent = live;
      root.classList.toggle('peek', show);
      root.classList.toggle('peek-done', show && !busy);
    }
    on(peek, 'pointerenter', () => setState('open'));

    // Typing something unsent is the one thing that holds it open.
    const keepOpen = () => document.activeElement === input && !!input.value.trim();

    on(box, 'pointerenter', () => {
      clearTimeout(leaveTimer);
      leaveTimer = 0;
      if (state === 'idle') setState(hist.msgs.length || busy ? 'open' : 'hover');
    });
    on(box, 'click', (e) => {
      if (e.target.closest('.gcx-ask-send, .gcx-ask-new, .gcx-ask-log button, .gcx-ask-log a')) return;
      if (state !== 'open') setState('open');
      else if (!e.target.closest('.gcx-ask-log')) input.focus();
    });
    on(row, 'keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === row) {
        e.preventDefault();
        setState('open');
      }
    });
    // Tabbing out of the chat tucks it away, same as moving the pointer off it.
    on(root, 'focusout', () =>
      setTimeout(() => {
        if (spot) return;
        if (state !== 'idle' && !root.contains(document.activeElement) && !root.matches(':hover') && !keepOpen()) setState('idle');
      }),
    );
    on(root, 'focusin', (e) => {
      clearTimeout(leaveTimer);
      leaveTimer = 0;
      if (state !== 'open' && e.target !== row) setState('open');
    });

    // Leaving the area (the box plus a margin) for a moment closes it, answer streaming or not.
    const PAD = 60;
    const inside = (x, y) => {
      const r = box.getBoundingClientRect();
      return x >= r.left - PAD && x <= r.right + PAD && y >= r.top - PAD && y <= r.bottom + PAD;
    };
    const scheduleClose = (ms) => {
      if (leaveTimer) return;
      leaveTimer = setTimeout(() => {
        leaveTimer = 0;
        if (!keepOpen()) setState('idle');
      }, ms);
    };
    on(
      document,
      'pointermove',
      (e) => {
        if (spot || state === 'idle') return;
        if (inside(e.clientX, e.clientY)) {
          clearTimeout(leaveTimer);
          leaveTimer = 0;
          return;
        }
        if (keepOpen()) return;
        scheduleClose(state === 'hover' ? 150 : 400);
      },
      { passive: true },
    );
    on(document.documentElement, 'pointerleave', () => {
      if (!spot && state !== 'idle' && !keepOpen()) scheduleClose(400);
    });
    on(document, 'keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (spot) {
        // Esc on some other Canvas menu or dialog shouldn't close this (and cut off its answer).
        const a = document.activeElement;
        if (opts.onClose && (root.contains(a) || a === document.body || !a || root.classList.contains('compact'))) opts.onClose();
        return;
      }
      if (state !== 'idle' && (root.contains(document.activeElement) || state === 'open')) {
        if (busy) stop();
        setState('idle');
      }
    });
    if (spot) on(root.querySelector('.gcx-ask-x'), 'click', () => opts.onClose && opts.onClose());

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
    on(log, 'click', (e) => {
      const b = e.target.closest('.gcx-ask-suggest button');
      if (b) ask(b.textContent);
    });
    on(newBtn, 'click', () => {
      if (busy) stop();
      if (run) run.discard = true;
      // The other chat may be the one answering; it shares this history, so stop it too.
      if (asking && asking !== root && asking.gcxCancel) asking.gcxCancel();
      hist = { msgs: [], prev: null };
      live = '';
      unseen = false;
      saveHist();
      renderLog();
      input.value = '';
      input.focus();
    });

    function setBusy(b) {
      busy = b;
      root.classList.toggle('busy', b);
      sendBtn.innerHTML = icon(b ? ICON.stop : ICON.send, 16);
      sendBtn.setAttribute('aria-label', b ? 'Stop' : 'Send');
      updatePeek();
    }
    on(sendBtn, 'click', () => (busy ? stop() : ask(input.value)));
    on(input, 'keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!busy) ask(input.value);
      } else if (e.key === 'Escape') {
        if (spot) {
          if (opts.onClose) opts.onClose();
        } else {
          if (busy) stop();
          setState('idle');
          input.blur();
        }
      }
      // Typing here is for the chat only: page-level keyboard shortcuts (Canvas's, BetterCampus's)
      // were swallowing the space bar.
      e.stopPropagation();
    });

    // The key is typed into the extension's own options page, never into a field on the Canvas page.
    function showKeyPrompt(msg) {
      keyMode = true;
      root.classList.remove('empty');
      log.innerHTML = `<div class="gcx-ask-msg bot err">${esc(msg)} Add your OpenAI API key on the extension's settings page, then ask again.
        <button type="button" class="gcx-ask-keybtn">Add key</button></div>`;
      log.querySelector('.gcx-ask-keybtn').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'openOptions' }).catch(() => {}));
      fit();
    }
    function retryAfterKey() {
      if (asking && asking !== root && asking.isConnected) {
        // The other chat is re-asking; just clear this one's "Add key" prompt.
        keyMode = false;
        renderLog();
        return;
      }
      keyMode = false;
      const last = hist.msgs[hist.msgs.length - 1];
      if (last && last.error) hist.msgs.pop();
      const q = hist.msgs.length && hist.msgs[hist.msgs.length - 1].role === 'user' ? hist.msgs.pop().text : '';
      saveHist();
      renderLog();
      if (q) ask(q);
    }
    const onKeyChange = (changes, area) => {
      if (area === 'local' && changes.openaiKey && changes.openaiKey.newValue && keyMode) {
        gcx.toast && gcx.toast('Key saved');
        retryAfterKey();
      }
    };
    chrome.storage.onChanged.addListener(onKeyChange);

    root.gcxDestroy = (keepAnswer = false) => {
      if (busy) stop();
      if (run && !keepAnswer) run.discard = true;
      ac.abort();
      ro.disconnect();
      clearTimeout(leaveTimer);
      chrome.storage.onChanged.removeListener(onKeyChange);
      root.remove();
    };

    // ----- one question: stream, run tools, repeat
    function stop() {
      if (run) {
        run.cancelled = true;
        if (run.resolve) run.resolve({ type: 'stopped' });
      if (run.onCancel) run.onCancel();
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
      // "sk-" only counts at the start of a token, so "risk-assessment-…" is still a question.
      if (/(?<![\w-])sk-[A-Za-z0-9_-]{20,}/.test(q)) {
        input.value = '';
        showKeyPrompt("Keys don't go in the chat.");
        return;
      }
      if (asking && asking !== root && asking.isConnected) {
        gcx.toast && gcx.toast('Still answering in the other chat');
        return;
      }
      keyMode = false;
      if (spot && root.classList.contains('compact')) {
        root.classList.remove('compact');
        if (opts.onAsk) opts.onAsk();
      }
      asking = root;
      root.gcxCancel = () => {
        stop();
        if (run) run.discard = true;
      };
      // Created first so Stop / New chat work even while the course list is still loading.
      const me = (run = { cancelled: false, discard: false, resolve: null, onCancel: null });
      let tier = routeTier(q);
      lastTier = tier;
      // Only navigate when he asked to go somewhere; otherwise the page is offered as a button.
      const wantsNav = /\b(go|open|take|bring|navigate|show)\b/i.test(q);
      let answeredBy = '';
      navRequest = null;
      // Both chats share one history; if either starts a new chat meanwhile, this answer is stale.
      const myHist = hist;
      const cancelled = new Promise((r) => (me.onCancel = r));
      live = 'Thinking…';
      unseen = false;
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
        live = previewText(text).slice(0, 140) || live;
        updatePeek();
        scroll();
      };
      const status = (s) => {
        announce(s + '…');
        if (!text) {
          live = s + '…';
          updatePeek();
        }
        if (text) {
          // Text came before a tool call: keep it and show the status under it.
          bot.innerHTML = md(text) + `<div class="gcx-ask-status"><span class="gcx-ask-dot"></span><span>${esc(s)}</span></div>`;
        } else statusEl.textContent = s;
        scroll();
      };

      // The course list can take a few seconds on a fresh page; Stop shouldn't wait for it.
      const instr = await Promise.race([instructions(), cancelled.then(() => null)]);
      if (me.cancelled && !text) text = '_Stopped._';
      const history = hist.msgs.slice(-12, -1).filter((m) => !m.error).map((m) => ({ role: m.role, content: m.text }));
      let req = hist.prev
        ? { type: 'start', tier, instructions: instr, tools: TOOL_DEFS, previous_response_id: hist.prev, input: [{ role: 'user', content: q }] }
        : { type: 'start', tier, instructions: instr, tools: TOOL_DEFS, input: [...history, { role: 'user', content: q }] };

      let finalId = null;
      let error = null;
      let settled = false; // false after the loop = it used up every round
      for (let round = 0; round < MAX_ROUNDS; round++) {
        if (me.cancelled) {
          if (!text) text = '_Stopped._';
          settled = true;
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
              if (!raf) raf = setTimeout(() => requestAnimationFrame(paint), 80);
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
          req = { type: 'start', tier, instructions: instr, tools: TOOL_DEFS, input: [...history, { role: 'user', content: q }] };
          round--;
          continue;
        }
        if (res.type === 'error') {
          error = res;
          settled = true;
          break;
        }
        if (res.type === 'stopped') {
          if (!text) text = '_Stopped._';
          settled = true;
          break;
        }
        if (res.type === 'done') {
          finalId = res.response_id;
          answeredBy = res.model || '';
          settled = true;
          break;
        }
        // tool_calls
        if (text && !/\n$/.test(text)) text += '\n\n';
        const outputs = await Promise.race([Promise.all(res.calls.map(runTool)), cancelled.then(() => null)]);
        if (!outputs) {
          // Stopped while tools ran.
          settled = true;
          if (!text) text = '_Stopped._';
          break;
        }
        status('Thinking');
        if (tier === 'fast' && res.calls.some((c) => READING.has(c.name))) tier = lastTier = 'smart';
        req = { type: 'continue', tier, instructions: instr, tools: TOOL_DEFS, previous_response_id: res.response_id, outputs };
      }
      clearTimeout(raf);
      if (run === me) run = null;
      if (asking === root) asking = null;
      setBusy(false);
      bot.classList.remove('live');
      // "New chat" was pressed mid-answer: drop this answer instead of writing it into the new chat.
      if (me.discard || hist !== myHist) {
        bot.remove();
        renderLog();
        return;
      }
      // Course content can't steer this: it only goes when his own question asked to go somewhere.
      // Otherwise the answer ends with a link to the page instead.
      let offer = null;
      if (navRequest && !error && !me.cancelled && !me.discard && hist === myHist) {
        const go = navRequest;
        if (wantsNav) {
          gcx.toast(`Opening ${go.label}…`);
          setTimeout(() => location.assign(go.url), 700);
        } else offer = go;
      }
      navRequest = null;
      if (offer) text = `${text || ''}\n\n[Open ${offer.label.replace(/[[\]]/g, '')}](${new URL(offer.url).pathname}${new URL(offer.url).search})`;
      if (error) {
        bot.remove();
        if (error.code === 'nokey' || error.code === 'badkey') {
          hist.msgs.push({ role: 'assistant', text: error.code === 'nokey' ? 'No OpenAI key yet.' : 'OpenAI rejected the key.', error: true });
          saveHist();
          showKeyPrompt(error.code === 'nokey' ? 'No OpenAI key yet.' : 'OpenAI rejected that key.');
          return;
        }
        hist.msgs.push({ role: 'assistant', text: `Couldn't answer: ${error.message}`, error: true });
        announce(`Couldn't answer: ${error.message}`);
      } else if (!settled) {
        // Ran out of lookups mid-answer. The thread on OpenAI's side is incomplete, so the next
        // question replays the visible history instead of continuing it.
        const note = `_Stopped after ${MAX_ROUNDS} lookups. Try a narrower question._`;
        hist.msgs.push({ role: 'assistant', text: text ? `${text.trim()}\n\n${note}` : note });
        hist.prev = null;
        announce(`Stopped after ${MAX_ROUNDS} lookups. Try a narrower question.`);
      } else {
        hist.msgs.push({ role: 'assistant', text: text || '(no answer)', model: answeredBy || undefined });
        if (finalId) hist.prev = finalId;
        announce(previewText(text || 'No answer.').slice(0, 600));
      }
      saveHist();
      renderLog();
      log.scrollTop = log.scrollHeight;
      // Finished while closed: leave the start of the answer in the preview until he looks.
      const last = hist.msgs[hist.msgs.length - 1];
      live = last ? previewText(last.text).slice(0, 140) : '';
      if (state !== 'open') unseen = true;
      updatePeek();
      if (state === 'open' && document.activeElement !== input && root.matches(':hover')) input.focus({ preventScroll: true });
    }

    renderLog();
    if (spot) setState('open');
    return root;
  }
  gcx.mountAsk = mountAsk;

  // ---------------------------------------------------------------- Ctrl+Space: ask from anywhere
  // The page blurs a little and a wide "Ask anything" pill appears in the middle, ready to type.
  // It can be dragged anywhere; the first question clears the blur and the pill grows into the
  // chat where it sits. Only the red X (or Esc, or Ctrl+Space again) closes it.
  const prefsNow = () => gcx.prefs();
  const spotOn = () => {
    const p = prefsNow();
    // Independent of the dashboard button: he can hide the button and keep the hotkey.
    return p.hotkey !== false;
  };
  let spotUi = null;
  function openSpot() {
    if (spotUi || !spotOn()) return;
    const back = document.activeElement;
    const bg = gcx.el('<div class="gcx-spot-bg" aria-hidden="true"></div>');
    const holder = gcx.el('<div class="gcx-spot"></div>');
    if (document.documentElement.classList.contains('gcx-fv-open')) {
      bg.classList.add('over-fv');
      holder.classList.add('over-fv');
    }
    document.body.append(bg, holder);
    // Before he's asked anything, moving the pointer well away from the pill (or clicking far
    // from it) closes it. Measured from where the pointer started, so it doesn't close at once
    // when the pointer happens to be across the screen.
    const distTo = (x, y) => {
      const r = holder.getBoundingClientRect();
      const dx = Math.max(r.left - x, 0, x - r.right);
      const dy = Math.max(r.top - y, 0, y - r.bottom);
      return Math.hypot(dx, dy);
    };
    const stillAPill = () => {
      const root = holder.querySelector('.gcx-ask');
      const input = holder.querySelector('input');
      return root && root.classList.contains('compact') && !(input && input.value.trim()) && !holder.classList.contains('dragging');
    };
    let startDist = null;
    const onFarMove = (e) => {
      if (!stillAPill()) return;
      const d = distTo(e.clientX, e.clientY);
      if (startDist === null) startDist = d;
      startDist = Math.min(startDist, Math.max(d, 0));
      if (d > Math.max(280, startDist + 220)) closeSpot();
    };
    addEventListener('pointermove', onFarMove, { passive: true });
    bg.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (stillAPill() && distTo(e.clientX, e.clientY) > 140) return closeSpot();
      holder.classList.remove('nudge');
      void holder.offsetWidth;
      holder.classList.add('nudge');
      holder.querySelector('input')?.focus({ preventScroll: true });
    });
    const W = Math.min(600, innerWidth - 32);
    holder.style.width = W + 'px';
    // Back where he last left it (kept inside the window), or centered the first time.
    let pos = null;
    try {
      pos = JSON.parse(localStorage.getItem('gcx:spotPos') || 'null');
    } catch {}
    const left = pos ? pos.left : (innerWidth - W) / 2;
    const top = pos ? pos.top : innerHeight * 0.36;
    holder.style.left = Math.round(Math.max(8, Math.min(left, innerWidth - W - 8))) + 'px';
    holder.style.top = Math.round(Math.max(8, Math.min(top, innerHeight - 120))) + 'px';
    const ui = (spotUi = { bg, holder, back, root: null, onFarMove });
    const clearBg = () => {
      bg.classList.add('gone');
      setTimeout(() => bg.remove(), 400);
    };
    ui.root = mountAsk(holder, { spot: true, onClose: closeSpot, onAsk: clearBg });
    requestAnimationFrame(() => ui.root && ui.root.querySelector('.gcx-ask-input').focus({ preventScroll: true }));

    // Keep it on screen: when it grows past the bottom edge, it slides up.
    const clamp = () => {
      const r = holder.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left, innerWidth - r.width - 8));
      const top = Math.max(8, Math.min(r.top, innerHeight - r.height - 8));
      if (Math.round(left) !== Math.round(r.left)) holder.style.left = left + 'px';
      if (Math.round(top) !== Math.round(r.top)) holder.style.top = top + 'px';
    };
    ui.ro = new ResizeObserver(() => !holder.classList.contains('dragging') && clamp());
    // Once the viewer it opened over closes (or a new one opens from an answer link), drop back
    // below the viewer so files open on top of the chat.
    const fvOpen = () => document.documentElement.classList.contains('gcx-fv-open');
    let wasFv = fvOpen();
    ui.fvMo = new MutationObserver(() => {
      if (fvOpen() === wasFv) return;
      wasFv = fvOpen();
      bg.classList.remove('over-fv');
      holder.classList.remove('over-fv');
    });
    ui.fvMo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    ui.ro.observe(holder);
    ui.onResize = () => clamp();
    addEventListener('resize', ui.onResize);

    // Drag by anything that isn't a control or the conversation text.
    holder.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('input, button, a, .gcx-ask-log')) return;
      e.preventDefault();
      const r = holder.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      holder.classList.add('dragging');
      // Listen on the window, not via pointer capture: capture on the moving element dropped
      // events mid-drag in testing, leaving it stuck.
      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        holder.style.left = Math.max(8, Math.min(ev.clientX - dx, innerWidth - r.width - 8)) + 'px';
        holder.style.top = Math.max(8, Math.min(ev.clientY - dy, innerHeight - holder.offsetHeight - 8)) + 'px';
      };
      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        holder.classList.remove('dragging');
        saveSpotPos(holder);
        removeEventListener('pointermove', move, true);
        removeEventListener('pointerup', up, true);
        removeEventListener('pointercancel', up, true);
      };
      addEventListener('pointermove', move, true);
      addEventListener('pointerup', up, true);
      addEventListener('pointercancel', up, true);
    });
  }
  const saveSpotPos = (holder) => {
    const r = holder.getBoundingClientRect();
    try {
      localStorage.setItem('gcx:spotPos', JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) }));
    } catch {}
  };
  function closeSpot() {
    const ui = spotUi;
    if (!ui) return;
    removeEventListener('pointermove', ui.onFarMove);
    spotUi = null;
    ui.holder.classList.add('closing');
    ui.bg.classList.add('gone');
    ui.ro.disconnect();
    ui.fvMo.disconnect();
    removeEventListener('resize', ui.onResize);
    setTimeout(() => {
      if (ui.root) ui.root.gcxDestroy(true);
      ui.holder.remove();
      ui.bg.remove();
    }, 200);
    if (ui.back && ui.back.isConnected && ui.back.focus) ui.back.focus({ preventScroll: true });
  }
  // Capture on window so page shortcut handlers can't swallow the chord.
  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || (e.code !== 'Space' && e.key !== ' ')) return;
      // Some keyboards switch input method with Ctrl+Space; leave that alone.
      if (e.isComposing || e.key === 'Process') return;
      if (!spotUi && !spotOn()) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (spotUi) closeSpot();
      else openSpot();
    },
    true,
  );
  window.addEventListener('gcx:prefs', () => {
    if (spotUi && !spotOn()) closeSpot();
  });

  // The dashboard's welcome row has a slot for it (classroom.js adds it). Settings can turn it off.
  const askOn = () => gcx.prefs().ask !== false;
  let mounted = null;
  const sync = () => {
    if (!askOn()) {
      if (mounted) mounted.gcxDestroy();
      mounted = null;
      return;
    }
    if (mounted && mounted.isConnected) return;
    const s = document.querySelector('.gcx-ask-slot');
    if (s) mounted = mountAsk(s) || s.querySelector('.gcx-ask');
  };
  window.addEventListener('gcx:prefs', sync);
  sync();
  if (!mounted && gcx.VIEW === '' && location.pathname === '/') {
    const mo = new MutationObserver(() => {
      if (document.querySelector('.gcx-ask-slot')) {
        mo.disconnect();
        sync();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 15000);
  }
})();
