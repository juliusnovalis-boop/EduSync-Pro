/**
 * Test de régression — modèle multi-établissements EduSync Pro.
 * Prérequis : serveur de dev local sur :3199 (npx next dev -p 3199).
 * Usage : node scripts/test-multi-etablissements.mjs
 * NB : attend un SUPER_ADMIN local ; identifiants surchargés via
 *      EDUSYNC_TEST_IDENTIFIER / EDUSYNC_TEST_PASSWORD.
 */
import dotenv from "dotenv";
dotenv.config();
const BASE = "http://localhost:3199";
const ADMIN_ID = process.env.EDUSYNC_TEST_IDENTIFIER ?? process.env.SUPER_ADMIN_EMAIL ?? "juliusnovalis@gmail.com";
const ADMIN_PWD = process.env.EDUSYNC_TEST_PASSWORD ?? process.env.SUPER_ADMIN_PASSWORD ?? "admin26";
let PASS = 0, FAIL = 0;
function check(name, cond, extra = "") {
  if (cond) { PASS++; console.log(`PASS ${name}`); } else { FAIL++; console.log(`FAIL ${name} ${extra}`); }
}
const jars = {};
async function call(jar, path, opts = {}) {
  const headers = { "x-edusync-env": "production", ...(opts.headers || {}) };
  if (opts.body) headers["Content-Type"] = "application/json";
  if (jars[jar]) headers["Cookie"] = jars[jar];
  const res = await fetch(BASE + path, { ...opts, headers, redirect: "manual" });
  const sc = res.headers.getSetCookie?.() ?? [];
  if (sc.length) {
    const keep = sc.map((c) => c.split(";")[0]).join("; ");
    jars[jar] = jars[jar] ? jars[jar] + "; " + keep : keep;
  }
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}
async function login(jar, identifier, password) {
  return call(jar, "/api/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) });
}

const lg = await login("admin", ADMIN_ID, ADMIN_PWD);
check("login admin", lg.status === 200, JSON.stringify(lg.body));
if (lg.status !== 200) { console.log(`SUMMARY: ${PASS}/${PASS + FAIL} PASS`); process.exit(1); }

const stamp = Date.now().toString(36);
const t = await call("admin", "/api/auth/users", { method: "POST", body: JSON.stringify({ role: "TEACHER", full_name: `MultiT T${stamp}`, password: "Passw0rd!" }) });
check("create TEACHER 201 (app_users + teachers)", t.status === 201, JSON.stringify(t.body));
const s1 = await call("admin", "/api/auth/users", { method: "POST", body: JSON.stringify({ role: "STUDENT", full_name: `El1 S${stamp}`, password: "Passw0rd!" }) });
const s2 = await call("admin", "/api/auth/users", { method: "POST", body: JSON.stringify({ role: "STUDENT", full_name: `El2 S${stamp}`, password: "Passw0rd!" }) });
check("create STUDENT x2", s1.status === 201 && s2.status === 201);
const p = await call("admin", "/api/auth/users", { method: "POST", body: JSON.stringify({ role: "PARENT", full_name: `Par P${stamp}`, password: "Passw0rd!" }) });
check("create PARENT 201", p.status === 201);

const teachers = await call("admin", "/api/data/teachers");
const tRow = (teachers.body ?? []).find((r) => r.last_name === `T${stamp}`);
check("teachers.user_id lié", !!tRow?.user_id, JSON.stringify(tRow ?? {}));
const students = await call("admin", "/api/data/students");
const sRow1 = (students.body ?? []).find((r) => r.last_name === `S${stamp}` && r.first_name === "El1");
const sRow2 = (students.body ?? []).find((r) => r.last_name === `S${stamp}` && r.first_name === "El2");
check("students.user_id lié x2", !!sRow1?.user_id && !!sRow2?.user_id);

let classes = await call("admin", "/api/data/classes?ascending=true");
let list = classes.body ?? [];
if (list.length < 2) {
  await call("admin", "/api/data/classes", { method: "POST", body: JSON.stringify({ name: `CL-A-${stamp}`, level: "6e" }) });
  await call("admin", "/api/data/classes", { method: "POST", body: JSON.stringify({ name: `CL-B-${stamp}`, level: "5e" }) });
  classes = await call("admin", "/api/data/classes?ascending=true");
  list = classes.body ?? [];
}
const cls1 = list.find((c) => c.name === `CL-A-${stamp}`) ?? list[0];
const cls2 = list.find((c) => c.name === `CL-B-${stamp}`) ?? list.find((c) => c.id !== cls1.id);
await call("admin", `/api/data/students/${sRow1.id}`, { method: "PUT", body: JSON.stringify({ class_id: cls1.id }) });
await call("admin", `/api/data/students/${sRow2.id}`, { method: "PUT", body: JSON.stringify({ class_id: cls2.id }) });
sRow1.class_id = cls1.id; sRow2.class_id = cls2.id;
check("2 classes distinctes", cls1 && cls2 && cls1.id !== cls2.id, JSON.stringify({ cls1: cls1?.id, cls2: cls2?.id }));

const a1 = await call("admin", "/api/data/teacher_class_assignments", { method: "POST", body: JSON.stringify({ teacher_id: tRow.id, class_id: cls1.id, status: "active" }) });
check("affectation classe 1", a1.status === 201, JSON.stringify(a1.body));
const dup = await call("admin", "/api/data/teacher_class_assignments", { method: "POST", body: JSON.stringify({ teacher_id: tRow.id, class_id: cls1.id, subject_id: null, status: "active" }) });
check("doublon affectation refusé (unique)", dup.status >= 400, String(dup.status));

const parentUserId = p.body?.user?.id ?? p.body?.id ?? "";
const l1 = await call("admin", "/api/data/parent_student_links", { method: "POST", body: JSON.stringify({ parent_user_id: parentUserId, student_id: sRow1.id }) });
check("lien parent-enfant 1", l1.status === 201, JSON.stringify(l1.body));
const l2dup = await call("admin", "/api/data/parent_student_links", { method: "POST", body: JSON.stringify({ parent_user_id: parentUserId, student_id: sRow1.id }) });
check("doublon lien parent refusé (unique)", l2dup.status >= 400, String(l2dup.status));

const tCred = t.body?.credentials ?? {};
await login("teacher", tCred.id ?? tCred.login_id, tCred.password);
const tStudents = await call("teacher", "/api/data/students");
const seesOnlyClass1 = (tStudents.body ?? []).every((r) => r.class_id === cls1.id) && (tStudents.body ?? []).some((r) => r.id === sRow1.id) && !(tStudents.body ?? []).some((r) => r.id === sRow2.id);
check("TEACHER voit uniquement sa classe", seesOnlyClass1, `n=${(tStudents.body ?? []).length}`);
const tClasses = await call("teacher", "/api/data/classes");
const tClassesOk = (tClasses.body ?? []).some((c) => c.id === cls1.id) && !(tClasses.body ?? []).some((c) => c.id === cls2.id);
check("TEACHER classes = affectées uniquement", tClassesOk, `n=${(tClasses.body ?? []).length}`);

const pCred = p.body?.credentials ?? {};
await login("parent", pCred.id ?? pCred.login_id, pCred.password);
const pStudents = await call("parent", "/api/data/students");
const pOk = (pStudents.body ?? []).some((r) => r.id === sRow1.id) && !(pStudents.body ?? []).some((r) => r.id === sRow2.id);
check("PARENT voit uniquement son enfant", pOk, `n=${(pStudents.body ?? []).length}`);

const aStudents = await call("admin", "/api/data/students");
check("ADMIN voit tout", (aStudents.body ?? []).some((r) => r.id === sRow2.id));

// --- Cleanup (données de test uniquement)
if (a1.body?.id) await call("admin", `/api/data/teacher_class_assignments/${a1.body.id}`, { method: "DELETE" });
if (l1.body?.id) await call("admin", `/api/data/parent_student_links/${l1.body.id}`, { method: "DELETE" });
for (const u of [t, s1, s2, p]) {
  const uid = u.body?.user?.id ?? u.body?.id;
  if (uid) await call("admin", `/api/auth/users/${uid}`, { method: "DELETE" });
}
if (tRow?.id) await call("admin", `/api/data/teachers/${tRow.id}`, { method: "DELETE" });
for (const r of [sRow1, sRow2]) if (r?.id) await call("admin", `/api/data/students/${r.id}`, { method: "DELETE" });
console.log(`SUMMARY: ${PASS}/${PASS + FAIL} PASS`);
process.exit(FAIL ? 1 : 0);