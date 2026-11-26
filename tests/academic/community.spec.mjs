import { collectErrors, layout } from '../page-checks.mjs';
import { test as base, expect, mockCapabilities } from '../session-fixture.mjs';
import fs from 'node:fs';
import path from 'node:path';
const test = base.extend({
  page: async ({ page }, use, info) => {
    const errors = collectErrors(page);
    await use(page);
    expect(errors).toEqual([]);
    await layout(page, info.project.metadata.locale);
  },
});
const web=process.env.WEB_PATH || path.resolve('workspace/web');
const obj=(id,kind,name,extra={})=>({id,kind,name,school_id:'school',credits:null,aliases:[],revision:1,updated_at:'2026-10-27T00:00:00Z',...extra});
const school=obj('school','school','Test University');
const course=obj('course','course','Test Course',{department_id:'dept'});
const teacher=obj('teacher-a','teacher','Teacher A');
const otherTeacher=obj('teacher-b','teacher','Teacher B');
const terms=[obj('fall','term','Fall semester'),obj('spring','term','Spring semester')];
const offerings=[obj('offering-fall','term_course','Fall offering',{course_id:'course',term_id:'fall'}),obj('offering-spring','term_course','Spring offering',{course_id:'course',term_id:'spring'})];
const classes=[obj('class-one','class','Class One',{term_course_id:'offering-fall',category_id:'seminar',nature_id:'optional'})];
const schedules=[obj('schedule','schedule','Teaching time',{class_id:'class-one',time_text:'Monday 09:00',location:'Room A'})];
const restrictedKinds=new Set(['term_course','class','assignment','schedule']);
const directory={term_course:offerings,class:classes,schedule:schedules,school:[school],department:[obj('dept','department','Test College')],category:[obj('seminar','category','Test Seminar')],nature:[obj('optional','nature','Optional')],term:terms,course:[course],teacher:[teacher,otherTeacher]};
const dimensions=Array.from({length:5},()=>({level:3,samples:2,courses:1}));
const review={id:'review',root_id:'review',kind:'course',school_id:'school',target_id:'course',term_id:'fall',title:'A student review',body:'Useful course content.',ratings:[3,3,3,3,3],author:{anonymous:true,handle:'anonymous'},revision:1,published_at:'2026-10-27T00:00:00Z',upvotes:0,downvotes:0,my_vote:0,mine:false,state:'published',can_edit:false,teacher_ids:['teacher-a','teacher-b'],grade:{scale:'percent',value:92}};
// A member with current consent and confirmed campus eligibility.
const member={authenticated:true,content_school_id:'school',profile:{id:'00000000-0000-4000-8000-000000000001',nickname:'Fixture student',nickname_required:false,bio:'',visibility:{school:true,badge:true,department:true,grade:false,reviews:true,resources:true},group_card_consent:{school:false,grade:false,department:false,name:false,student_id:false,gender:false,nickname:false},revision:1},csrf_token:'a'.repeat(43),phone_bound:true,administrator:false,expires_at:'2030-01-01T00:00:00Z'};
const webSession = JSON.parse(fs.readFileSync(path.join(web, 'contracts/session.openapi.json'), 'utf8'));
if (webSession.components.schemas.FullSession?.required?.includes('consent_required')) {
  member.consent_required = false;
}
const summary={campus_eligibility:true,teacher_verified:false,identity_verified:false,evaluated_at:'2026-10-28T00:00:00Z',revision:1,next_evaluation_at:null};
const fulfill=(route,value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
const composeBase={allowed:true,state:'ready',requirements:[],terms:[],teachers:[],identity:'choice',rule_version:'fixture'};
function courseComposer(term, marked) {
  return {
    ...composeBase,
    allowed:!!term,
    state:term?'ready':'choose_term',
    requirements:['login','campus_eligibility','phone_bound'].map(key=>({key,state:'satisfied'})),
    terms:[terms[1],terms[0]].map(({id,name})=>({id,name,term_order_key:id==='fall'?20263:20271,enrolled:marked&&id==='spring'})),
    teachers:term?(term==='fall'?[teacher]:[teacher,otherTeacher]).map(({id})=>({
      id,enrolled:marked&&term==='spring'&&id===otherTeacher.id,
    })):[],
  };
}
export async function fixture(page){
  await mockCapabilities(page);
  await page.route('**/api/v1/**',async route=>{
    const u=new URL(route.request().url()),p=u.pathname;
    if(p==='/api/v1/system/capabilities')return route.fallback();
    if(p==='/api/v1/auth/session')return fulfill(route,member);
    if(p==='/api/v1/verification/summary')return fulfill(route,summary);
    if(p==='/api/v1/verification/me/school-data')return fulfill(route,{state:'active'});
    if(p==='/api/v1/catalog/directory'){
      const kind=u.searchParams.get('kind')||'course';
      const selected=kind==='course'?[course]:[teacher,otherTeacher];
      const items=selected.map(object=>({object,departments:directory.department,categories:kind==='course'?directory.category:[],review_count:1,recommendation:'recommended',dimensions,heat:1}));
      return fulfill(route,{items,next:'',total:items.length,facet_total:items.length,nature_facets: [], category_facets:kind==='course'?[{id:'seminar',name:'Test Seminar',count:1,review_count:1}]:[],department_facets:[{id:'dept',name:'Test College',count:items.length,review_count:items.length}],generated_at:'2026-11-16T00:00:00Z'});
    }
    if(p==='/api/v1/catalog/objects'){
      const kind=u.searchParams.get('kind');
      if(restrictedKinds.has(kind)||u.searchParams.has('class_id')||u.searchParams.has('term_course_id'))return fulfill(route,{code:'forbidden'},403);
      let items=directory[kind]??[];
      if(kind==='term_course')items=items.filter(item=>(!u.searchParams.get('term_id')||item.term_id===u.searchParams.get('term_id'))&&(!u.searchParams.get('teacher_id')||item.term_id===(u.searchParams.get('teacher_id')==='teacher-a'?'fall':'spring')));
      if(kind==='teacher'&&u.searchParams.get('class_id'))items=[teacher];
      return fulfill(route,{items,next:''});
    }
    if(p==='/api/v1/catalog/objects/lookup'){const ids=(u.searchParams.get('ids')??'').split(',');const items=Object.values(directory).flat().filter(item=>ids.includes(item.id)&&!restrictedKinds.has(item.kind));return fulfill(route,{items,missing_ids:ids.filter(id=>!items.some(item=>item.id===id))});}
    if(p.startsWith('/api/v1/catalog/objects/')){const id=p.split('/')[5];const item=Object.values(directory).flat().find(v=>v.id===id);if(item&&restrictedKinds.has(item.kind))return fulfill(route,{code:'not_found'},404);}
    if(p.endsWith('/summary')){const id=p.split('/').at(-2);const entry=Object.values(directory).flat().find(item=>item.id===id);return fulfill(route,{object:entry,school,department:entry.kind==='course'?directory.department[0]:null,categories:entry.kind==='course'?directory.category:[],natures:entry.kind==='course'?directory.nature:[],courses: [], teachers: [], course_count:1,teacher_count:entry.kind==='course'?2:1});}
    if(p.startsWith('/api/v1/catalog/objects/')){const id=p.split('/').at(-1);return fulfill(route,Object.values(directory).flat().find(v=>v.id===id)??course);}
    if(p==='/api/v1/catalog/me/enrollments')return fulfill(route,terms.map((term,i)=>({id:`enrollment-${i}`,subject:'synthetic',school_id:'school',course_id:'course',term_id:term.id,teacher_ids:[i===0?'teacher-a':'teacher-b'],active:true})));
    if(p==='/api/v1/reviews/compose'){
      return fulfill(route,u.searchParams.get('kind')==='course'?courseComposer(u.searchParams.get('term_id'),true):composeBase);
    }
    if(p==='/api/v1/reviews/presentation')return fulfill(route,{effective:{school_id:'school',revision:0,rating_texts:{}},configured:null,source:'default'});
    if(p==='/api/v1/reviews/statistics')return fulfill(route,{dimensions,courses:[{course_id:'course',dimensions}],next:'',from:u.searchParams.get('from'),until:u.searchParams.get('until')});
    if(p==='/api/v1/reviews'&&route.request().method()==='GET')return fulfill(route,{items:u.searchParams.get('kind')==='course'?[review]:[],next:''});
    if(p==='/api/v1/reviews/review')return fulfill(route,review);
    if(p==='/api/v1/reviews/me/entries')return fulfill(route,{items:[],next:''});
    if(p==='/api/v1/reviews/me/references'){const ids=(u.searchParams.get('ids')??'').split(',');const items=Object.values(directory).flat().filter(item=>ids.includes(item.id)&&!restrictedKinds.has(item.kind)).map(({id,kind,name})=>({id,kind,name}));return fulfill(route,{items,missing_ids:ids.filter(id=>!items.some(item=>item.id===id))});}
    if(p.startsWith('/api/v1/reviews/me/')||p==='/api/v1/moderation/tasks')return fulfill(route,[]);
    return fulfill(route,{code:'not_found'},404);
  });
}
const catalogue=info=>JSON.parse(fs.readFileSync(path.join(web,`src/locales/${info.project.metadata.locale}.json`)));
const dimensionNames=['recommendation','quality','difficulty','workload','grading'];
const draftInput={kind:'course',target_id:'course',term_id:'fall',teacher_ids:['teacher-a'],title:'Saved review',body:'Saved first-hand experience.',ratings:[3,3,3,3,3],signed:false};
const editorOf=(page,a,kind)=>page.locator('form').filter({has:page.getByRole('heading',{name:a.editor.heading[kind],exact:true})});
const pick=(scope,label,option)=>scope.getByRole('group',{name:label,exact:true}).getByText(option,{exact:true}).click();
async function choose(page,label,option){
  await page.getByRole('combobox',{name:label}).click();
  await page.getByRole('option',{name:option,exact:true}).click();
}
async function rate(editor,a){
  for(const key of dimensionNames)await pick(editor,a.ratings[key].label,a.ratings[key].level3);
}
test.beforeEach(async({page})=>fixture(page));

test('a member with current consent can open the account menu from the course directory', async ({ page }, info) => {
  const { locale } = info.project.metadata;
  await page.goto(`/courses?lang=${locale}`);
  await page.getByRole('button', { name: catalogue(info).nav.account, exact: true }).click();
  await expect(page.getByRole('menuitem', { name: /Fixture student/ })).toBeVisible();
});

test('directory has college/category filters and no semester control',async({page},info)=>{
  const locale=info.project.metadata.locale,a=catalogue(info).academic,all=catalogue(info);
  const requests=[];page.on('request',req=>{if(req.url().includes('/catalog/directory?')&&req.url().includes('kind=course'))requests.push(new URL(req.url()));});
  await page.goto(`/courses?lang=${locale}`);
  await expect(page.getByRole('link',{name:/Test Course/})).toBeVisible();
  await expect(page.getByRole('combobox',{name:a.feed.term})).toHaveCount(0);
  await choose(page,all.browse.offeringDepartment,'Test College');
  const category=page.getByRole('group',{name:all.browse.courseCategory,exact:true}).getByRole('button',{name:/Test Seminar/});
  await category.click();
  await expect(category).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>requests.some(u=>u.searchParams.get('department_id')==='dept'&&u.searchParams.get('category_id')==='seminar')).toBe(true);
  expect(requests.every(u=>!u.searchParams.has('term_id'))).toBe(true);
});

test('former course link opens the current course with its names and context', async ({ page }, info) => {
  const locale = info.project.metadata.locale;
  const labels = catalogue(info).academic.subject;
  const current = { ...course, english_name: 'Systems Engineering', former_codes: ['OLD-201'], former_names: ['Original title'] };
  await page.route('**/catalog/objects/old-course/summary', route => fulfill(route, { code: 'not_found' }, 404));
  await page.route('**/catalog/objects/old-course/resolution', route => fulfill(route, {
    object: { ...current, canonical_id: current.id }, ids: ['old-course', current.id],
  }));
  await page.route('**/catalog/objects/course/summary', route => fulfill(route, {
    object: current, school, department: directory.department[0], categories: [], natures: [], courses: [], teachers: [], course_count: 1, teacher_count: 2,
  }));
  await page.goto(`/courses/old-course?lang=${locale}&term_id=fall`);
  await expect(page).toHaveURL(url => url.pathname === '/courses/course' && url.searchParams.get('term_id') === 'fall');
  for (const [label, value] of [[labels.englishName, current.english_name], [labels.formerCodes, 'OLD-201'], [labels.formerNames, 'Original title']]) {
    await expect(page.locator('dt').filter({ hasText: label }).locator('xpath=following-sibling::dd[1]')).toHaveText(value);
  }
});

test('course review renders grades and retries the selected teacher array after a lost response',async({page},info)=>{
  const all=catalogue(info),a=all.academic,posts=[];
  await page.route('**/api/v1/reviews',async route=>{
    if(route.request().method()!=='POST')return route.fallback();
    posts.push({body:route.request().postData(),key:route.request().headers()['idempotency-key']});
    if(posts.length===1)return route.abort('failed');
    return fulfill(route,{id:'new-review',state:'pending',revision:1});
  });
  await page.goto(`/courses/course?lang=${info.project.metadata.locale}`);
  const card=page.locator('article').filter({hasText:'Useful course content.'}).first();
  for(const key of dimensionNames)await expect(card.getByText(a.ratings[key].label,{exact:true})).toBeVisible();
  const formatter=new Intl.NumberFormat(info.project.metadata.locale);
  await expect(card).toContainText(a.grade.display.replace('{value}',formatter.format(92)));
  const names=new Intl.ListFormat(info.project.metadata.locale,{style:'long',type:'conjunction'});
  await expect(card).toContainText(names.format(['Teacher A','Teacher B']));
  await page.getByRole('button',{name:a.subject.writeCourse,exact:true}).click();
  const editor=editorOf(page,a,'course');
  const terms=editor.getByRole('group',{name:a.editor.term,exact:true});
  await expect(terms.getByRole('radio',{name:`Spring semester ${a.editor.enrolledMark}`,exact:true})).toBeVisible();
  await pick(editor,a.editor.term,'Fall semester');
  const teachers=editor.getByRole('group',{name:a.editor.teacher,exact:true});
  await expect(teachers.getByText('Teacher A',{exact:true})).toBeVisible();
  await expect(teachers.getByRole('checkbox',{name:/Teacher B/})).toHaveCount(0);
  await pick(editor,a.editor.teacher,'Teacher A');
  await pick(editor,a.editor.term,'Spring semester');
  await expect(teachers.getByRole('checkbox',{name:`Teacher B ${a.editor.enrolledMark}`,exact:true})).toBeVisible();
  await expect(teachers.getByRole('checkbox',{name:/Teacher A/})).not.toBeChecked();
  await pick(editor,a.editor.teacher,'Teacher A');
  await pick(editor,a.editor.teacher,'Teacher B');
  await rate(editor,a);
  await editor.getByLabel(a.editor.title,{exact:true}).fill('My course review');
  await editor.getByLabel(a.editor.body,{exact:true}).fill('First-hand teaching experience.');
  await expect(editor.getByText(a.grade.hint,{exact:true})).toBeVisible();
  await pick(editor,a.grade.label,a.grade.scales.two_level);
  await pick(editor,a.grade.levelLabel,a.grade.two.pass);
  await editor.getByRole('button',{name:a.editor.publish,exact:true}).click();
  await expect(page.getByText(all.common.uncertain,{exact:true})).toBeVisible();
  await expect(editor.getByLabel(a.editor.body,{exact:true})).toHaveValue('First-hand teaching experience.');
  await page.getByRole('button',{name:all.common.retryOriginal,exact:true}).click();
  await expect(page.getByText(a.editor.pending,{exact:true})).toBeVisible();
  expect(posts).toHaveLength(2);expect(posts[1]).toEqual(posts[0]);
  const input=JSON.parse(posts[0].body);
  expect(input).toMatchObject({term_id:'spring',grade:{scale:'two_level',value:'pass'},signed:false,ratings:[3,3,3,3,3]});
  expect([...input.teacher_ids].sort()).toEqual(['teacher-a','teacher-b']);
});

test('mentor template can be replaced without rating fields',async({page},info)=>{
  const a=catalogue(info).academic;let posted;
  await page.route('**/api/v1/reviews',async route=>{if(route.request().method()!=='POST')return route.fallback();posted=route.request().postDataJSON();return fulfill(route,{id:'mentor',state:'published',revision:1});});
  await page.goto(`/teachers/teacher-a?lang=${info.project.metadata.locale}`);
  await page.getByRole('button',{name:a.subject.writeMentor,exact:true}).click();
  const editor=editorOf(page,a,'mentor');
  await expect(editor.getByLabel(a.editor.body,{exact:true})).toHaveValue(a.editor.mentorTemplate);
  await expect(editor.getByRole('group',{name:a.ratings.recommendation.label,exact:true})).toHaveCount(0);
  await editor.getByLabel(a.editor.title,{exact:true}).fill('Supervision experience');
  await editor.getByLabel(a.editor.body,{exact:true}).fill('My own description.');
  await editor.getByRole('button',{name:a.editor.publish,exact:true}).click();
  await expect(page.getByText(a.editor.published,{exact:true})).toBeVisible();
  expect(posted).toMatchObject({kind:'mentor',body:'My own description.',ratings:[0,0,0,0,0]});
  expect(posted).not.toHaveProperty('term_id');
});

test('personal page distinguishes failure and denied access without stale contents',async({page},info)=>{
  const all=catalogue(info);let requests=0;
  await page.route('**/api/v1/reviews/me/entries?*',route=>{requests++;return fulfill(route,{code:requests===1?'unavailable':'forbidden'},requests===1?503:403);});
  await page.goto(`/me/reviews?lang=${info.project.metadata.locale}`);
  await expect(page.getByText(all.errors.unavailable,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:all.common.retry,exact:true}).click();
  await expect(page.getByText(all.errors.forbidden,{exact:true})).toBeVisible();
  await expect(page.getByText(review.body,{exact:true})).toHaveCount(0);
});

test('public course summaries work without teaching counts and hidden teaching routes do not load',async({page},info)=>{
  const a=catalogue(info).academic,restricted=[];
  page.on('request',request=>{const u=new URL(request.url());if(u.pathname.startsWith('/api/v1/catalog/')&&(restrictedKinds.has(u.searchParams.get('kind'))||u.searchParams.has('class_id')||u.searchParams.has('term_course_id')||/\/(offering-fall|class-one|schedule)(?:\/|$)/.test(u.pathname)))restricted.push(u.pathname);});
  await page.goto(`/courses/course?lang=${info.project.metadata.locale}`);
  await expect(page.getByRole('heading',{name:'Test Course',exact:true})).toBeVisible();
  await expect(page.getByText('Test College',{exact:true}).first()).toBeVisible();
  await expect(page.getByRole('tab',{name:a.offerings.title,exact:true})).toHaveCount(0);
  await expect(page.locator('a[href^="/offerings/"],a[href^="/classes/"]')).toHaveCount(0);
  for(const route of ['/offerings/offering-fall','/classes/class-one']){
    await page.goto(`${route}?lang=${info.project.metadata.locale}`);
    await expect(page).toHaveURL(/\/courses(?:\?|$)/);
    await expect(page.getByRole('link',{name:/Test Course/})).toBeVisible();
    await expect(page.getByText('Room A',{exact:true})).toHaveCount(0);
  }
  expect(restricted).toEqual([]);
});

test('incomplete draft saves and later publishes through its original draft',async({page},info)=>{
  const a=catalogue(info).academic,posts=[];
  await page.route('**/api/v1/reviews/me/drafts',route=>{
    posts.push({path:new URL(route.request().url()).pathname,body:route.request().postDataJSON()});
    return fulfill(route,{id:'draft',state:'draft',revision:1});
  });
  await page.route('**/api/v1/reviews/me/drafts/draft/publish',route=>{
    posts.push({path:new URL(route.request().url()).pathname,body:route.request().postDataJSON()});
    return fulfill(route,{id:'published',state:'published',revision:1});
  });
  await page.goto(`/courses/course?lang=${info.project.metadata.locale}`);
  await page.getByRole('button',{name:a.subject.writeCourse,exact:true}).click();
  const editor=editorOf(page,a,'course');
  await editor.getByLabel(a.editor.body,{exact:true}).fill('Working notes.');
  await editor.getByRole('button',{name:a.editor.saveDraft,exact:true}).click();
  await expect(page.getByText(a.editor.draftSaved,{exact:true})).toBeVisible();
  expect(posts[0].body.input).toMatchObject({term_id:'',ratings:[0,0,0,0,0]});
  await pick(editor,a.editor.term,'Fall semester');
  await editor.getByLabel(a.editor.title,{exact:true}).fill('Finished review');
  await rate(editor,a);
  await editor.getByRole('button',{name:a.editor.publish,exact:true}).click();
  await expect(page.getByText(a.editor.published,{exact:true})).toBeVisible();
  expect(posts).toHaveLength(2);
  expect(posts[1]).toMatchObject({path:'/api/v1/reviews/me/drafts/draft/publish',body:{revision:1,input:{body:'Working notes.',term_id:'fall'}}});
});

test('draft conflict keeps local writing until the author chooses a version',async({page},info)=>{
  const all=catalogue(info),a=all.academic,draft={id:'draft',revision:1,input:draftInput,withdrawn:false,reference_ids:['course','teacher-a'],reference_state:'verified'};let reads=0,posted;
  await page.route('**/api/v1/reviews/me/drafts?*',route=>fulfill(route,[draft]));
  await page.route('**/api/v1/reviews/me/drafts/draft',route=>{reads++;return fulfill(route,reads===1?draft:{...draft,revision:2,input:{...draftInput,body:'Edited on another device.'}})});
  await page.route('**/api/v1/reviews/me/drafts/draft/publish',route=>{
    const body=route.request().postDataJSON();
    if(body.revision===1)return fulfill(route,{code:'conflict'},409);
    posted=body;return fulfill(route,{id:'published',state:'published',revision:1});
  });
  await page.goto(`/me/reviews?tab=drafts&lang=${info.project.metadata.locale}`);
  await page.getByRole('button',{name:all.me.continueEditing,exact:true}).click();
  const editor=editorOf(page,a,'course');
  await editor.getByLabel(a.editor.body,{exact:true}).fill('Local writing to preserve.');
  await editor.getByRole('button',{name:a.editor.publish,exact:true}).click();
  await expect(page.getByText(a.editor.conflict,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:a.editor.loadLatest,exact:true}).click();
  await expect(page.getByText('Edited on another device.',{exact:true})).toBeVisible();
  await expect(editor.getByLabel(a.editor.body,{exact:true})).toHaveValue('Local writing to preserve.');
  await page.getByRole('button',{name:a.editor.keepMine,exact:true}).click();
  await editor.getByRole('button',{name:a.editor.publish,exact:true}).click();
  await expect(page.getByText(a.editor.published,{exact:true})).toBeVisible();
  await expect(editor).toHaveCount(0);
  expect(posted).toMatchObject({revision:2,input:{body:'Local writing to preserve.'}});
});

test('discussion refresh preserves writing and fixed identity when replying',async({page},info)=>{
  const a=catalogue(info).academic;let posted;
  await page.route('**/api/v1/reviews/compose?*',route=>fulfill(route,{...composeBase,identity:'anonymous'}));
  await page.route('**/api/v1/reviews/review/actions',route=>fulfill(route,{id:'review',state:'published',revision:1}));
  await page.route('**/api/v1/reviews/review/replies',route=>{posted=route.request().postDataJSON();return fulfill(route,{id:'reply',state:'published',revision:1})});
  await page.goto(`/reviews/review?lang=${info.project.metadata.locale}`);
  const editor=editorOf(page,a,'reply');
  await editor.getByLabel(a.editor.body,{exact:true}).fill('Reply kept while voting.');
  await expect(editor.getByRole('checkbox')).toHaveCount(0);
  await expect(editor.getByText(a.editor.identityAnonymous,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:new RegExp('^'+a.review.upvote.split('{')[0].trim())}).first().click();
  await expect(editor.getByLabel(a.editor.body,{exact:true})).toHaveValue('Reply kept while voting.');
  await editor.getByRole('button',{name:a.editor.publish,exact:true}).click();
  await expect(page.getByText(a.editor.published,{exact:true})).toBeVisible();
  expect(posted).toMatchObject({kind:'reply',body:'Reply kept while voting.',signed:false});
});

test('a member without school data authorization can submit from public candidates',async({page},info)=>{
  const a=catalogue(info).academic,enrollmentReads=[];let posted;
  page.on('request',req=>{if(new URL(req.url()).pathname==='/api/v1/catalog/me/enrollments')enrollmentReads.push(req.url());});
  await page.route('**/api/v1/verification/me/school-data',route=>fulfill(route,{state:'inactive'}));
  await page.route('**/api/v1/reviews/compose?*',route=>fulfill(route,courseComposer(new URL(route.request().url()).searchParams.get('term_id'),false)));
  await page.route('**/api/v1/reviews',route=>{
    if(route.request().method()!=='POST')return route.fallback();
    posted=route.request().postDataJSON();
    return fulfill(route,{id:'new-review',state:'pending',revision:1});
  });
  await page.goto(`/courses/course?lang=${info.project.metadata.locale}`);
  await page.getByRole('button',{name:a.subject.writeCourse,exact:true}).click();
  const editor=editorOf(page,a,'course');
  await expect(editor.getByRole('button',{name:a.editor.saveDraft,exact:true})).toBeEnabled();
  await pick(editor,a.editor.term,'Fall semester');
  await expect(editor.getByRole('checkbox',{name:'Teacher A',exact:true})).toBeVisible();
  await expect(editor.getByText(a.editor.enrolledLegend,{exact:true})).toHaveCount(0);
  await editor.getByLabel(a.editor.title,{exact:true}).fill('My course review');
  await editor.getByLabel(a.editor.body,{exact:true}).fill('First-hand teaching experience.');
  await rate(editor,a);
  await editor.getByRole('button',{name:a.editor.publish,exact:true}).click();
  await expect(page.getByText(a.editor.pending,{exact:true})).toBeVisible();
  expect(posted).toMatchObject({term_id:'fall'});
  expect(posted.teacher_ids??[]).toHaveLength(0);
  expect(enrollmentReads).toEqual([]);
});

test('student selects authoritative real name independently and sends no attribute values',async({page},info)=>{
  const a=catalogue(info).academic,labels=a.disclosure.labels;let posted;
  await page.route('**/api/v1/reviews/compose?*',route=>fulfill(route,{...composeBase,disclosures:[{key:'real_name',value:'Synthetic Student',required:false},{key:'gender',value:'Synthetic gender',required:false},{key:'department',value:'Synthetic College',required:false}]}));
  await page.route('**/api/v1/reviews',route=>{if(route.request().method()!=='POST')return route.fallback();posted=route.request().postDataJSON();return fulfill(route,{id:'named-student',state:'published',revision:1})});
  await page.goto(`/teachers/teacher-a?lang=${info.project.metadata.locale}`);
  await page.getByRole('button',{name:a.subject.writeMentor,exact:true}).click();
  const editor=editorOf(page,a,'mentor');
  const name=editor.getByRole('checkbox',{name:new RegExp(labels.real_name)});
  await expect(name).not.toBeChecked();await name.check();
  await expect(editor.getByRole('checkbox',{name:new RegExp(labels.teacher)})).toHaveCount(0);
  await expect(editor.getByRole('checkbox',{name:new RegExp(labels.enrollment)})).toHaveCount(0);
  await editor.getByLabel(a.editor.title,{exact:true}).fill('Student experience');
  await editor.getByLabel(a.editor.body,{exact:true}).fill('Voluntary real-name comment.');
  await editor.getByRole('button',{name:a.editor.publish,exact:true}).click();
  await expect(page.getByText(a.editor.published,{exact:true})).toBeVisible();
  expect(posted.disclosures).toEqual(['real_name']);expect(JSON.stringify(posted)).not.toContain('Synthetic Student');expect(posted.signed).toBe(false);
});

test('own-course teacher reply visibly requires authorized name and teacher badge',async({page},info)=>{
  const a=catalogue(info).academic,labels=a.disclosure.labels;let posted;
  await page.route('**/api/v1/reviews/compose?*',route=>fulfill(route,{...composeBase,identity:'anonymous',teacher_reply:true,disclosures:[{key:'real_name',value:'Synthetic Teacher',required:true},{key:'teacher',value:'verified',required:true},{key:'organization',value:'Synthetic Faculty',required:false}]}));
  await page.route('**/api/v1/reviews/review/replies',route=>{posted=route.request().postDataJSON();return fulfill(route,{id:'teacher-reply',state:'published',revision:1})});
  await page.goto(`/reviews/review?lang=${info.project.metadata.locale}`);
  const editor=editorOf(page,a,'reply');
  await expect(editor.getByText(a.disclosure.teacherRequired,{exact:true})).toBeVisible();
  await editor.getByLabel(a.editor.body,{exact:true}).fill('Response from the verified teacher.');
  const publish = editor.getByRole('button',{name:a.editor.publish,exact:true});
  for (const key of ['real_name', 'teacher']) {
    const option = editor.getByRole('checkbox', { name: new RegExp(labels[key]) });
    await expect(option).not.toBeChecked();
    await expect(publish).toBeDisabled();
    await option.check();
  }
  await editor.getByRole('button',{name:a.editor.publish,exact:true}).click();
  await expect(page.getByText(a.editor.published,{exact:true})).toBeVisible();
  expect(posted.disclosures.sort()).toEqual(['real_name','teacher']);expect(JSON.stringify(posted)).not.toContain('Synthetic Teacher');
});

test('teacher replying elsewhere can disclose only the verification badge',async({page},info)=>{
  const a=catalogue(info).academic,labels=a.disclosure.labels;let posted;
  await page.route('**/api/v1/reviews/compose?*',route=>fulfill(route,{...composeBase,teacher_reply:false,disclosures:[{key:'real_name',value:'Synthetic Teacher',required:false},{key:'teacher',value:'verified',required:false},{key:'organization',value:'Synthetic Faculty',required:false}]}));
  await page.route('**/api/v1/reviews/review/replies',route=>{posted=route.request().postDataJSON();return fulfill(route,{id:'teacher-reply',state:'published',revision:1})});
  await page.goto(`/reviews/review?lang=${info.project.metadata.locale}`);
  const editor=editorOf(page,a,'reply');
  await editor.getByRole('checkbox',{name:new RegExp(labels.teacher)}).check();
  await expect(editor.getByRole('checkbox',{name:new RegExp(labels.real_name)})).not.toBeChecked();
  await editor.getByLabel(a.editor.body,{exact:true}).fill('Reply with badge only.');
  await editor.getByRole('button',{name:a.editor.publish,exact:true}).click();
  await expect(page.getByText(a.editor.published,{exact:true})).toBeVisible();
  expect(posted.disclosures).toEqual(['teacher']);
});

test('author can request reconsideration of an eligible decision',async({page},info)=>{
  const all=catalogue(info),a=all.academic;let posted;
  const task={id:'handled',school_id:'school',can_appeal:true,submission:{object_id:'review',kind:'delete_request',reason:'Author request',evidence:[]},object_revision:1,revision:2,state:'applied',created_at:'2026-10-28T00:00:00Z',updated_at:'2026-10-28T00:00:00Z',decision:{id:'decision',object_id:'review',revision:1,action:'dismiss',reason:'Previous decision'}};
  await page.route('**/api/v1/moderation/tasks*',route=>{if(route.request().method()==='GET')return fulfill(route,[task]);posted=route.request().postDataJSON();return fulfill(route,{...task,id:'appeal',state:'waiting',can_appeal:false,submission:posted})});
  await page.goto(`/me/reviews?tab=requests&lang=${info.project.metadata.locale}`);
  await page.getByRole('button',{name:all.me.appeal,exact:true}).click();
  const dialog=page.getByRole('dialog').or(page.getByRole('alertdialog'));
  await dialog.getByLabel(a.review.reason,{exact:true}).fill('Additional evidence for reconsideration.');
  await dialog.getByRole('button',{name:all.common.submit,exact:true}).click();
  await expect(page.getByText(a.review.requestSent,{exact:true})).toBeVisible();
  expect(posted).toMatchObject({kind:'appeal',previous_task_id:'handled',object_id:'review',reason:'Additional evidence for reconsideration.'});
});
