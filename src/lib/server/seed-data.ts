/**
 * Jeu de données de démonstration EduSync Pro (Gabon) — portage fidèle du seed.
 * Idempotent par table : chaque table n'est remplie que si elle est vide.
 */

const SCHOOL_YEAR = "2025-2026";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function rnd(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

type Row = Record<string, unknown>;

export function buildSeedData() {
  const now = new Date().toISOString();

  const provinces: Row[] = [
    ["g1", "Estuaire", "G1", "Libreville"],
    ["g2", "Haut-Ogooué", "G2", "Franceville"],
    ["g3", "Moyen-Ogooué", "G3", "Lambaréné"],
    ["g4", "Ngounié", "G4", "Mouila"],
    ["g5", "Nyanga", "G5", "Tchibanga"],
    ["g6", "Ogooué-Ivindo", "G6", "Makokou"],
    ["g7", "Ogooué-Lolo", "G7", "Koulamoutou"],
    ["g8", "Ogooué-Maritime", "G8", "Port-Gentil"],
    ["g9", "Woleu-Ntem", "G9", "Oyem"],
  ].map(([id, name, code, capital]) => ({ id, name, code, capital, created_at: now }));

  const establishments: Row[] = [
    { id: "est-libreville", name: "Lycée National Léon Mba", code: "LNLM", province_id: "g1", city: "Libreville", address: "Avenue du Colonel Parant", phone: "+241 01 44 23 10", email: "contact@leonmba.ga", type: "mixte", director_name: "M. OBIANG ESSONO", school_year: SCHOOL_YEAR, status: "actif", created_at: now },
    { id: "est-ogm", name: "Lycée d'Application de l'ENS", code: "LAENS", province_id: "g1", city: "Libreville", address: "Quartier Batavéa", phone: "+241 01 45 00 12", email: "ens@education.ga", type: "secondaire", director_name: "Mme NDONG", school_year: SCHOOL_YEAR, status: "actif", created_at: now },
  ];

  const profiles: Row[] = [
    { id: "demo-user", full_name: "Administrateur Démo", email: "demo@edusync.ga", phone: "+241 06 00 00 00", establishment_id: "est-libreville" },
    { id: "u-ndong", full_name: "Clarisse NDONG", email: "c.ndong@edusync.ga", phone: "+241 06 98 76 54", establishment_id: "est-libreville" },
    { id: "u-mboumba", full_name: "Antoine MBOUMBA", email: "a.mboumba@edusync.ga", phone: "+241 06 12 34 56", establishment_id: "est-libreville" },
  ];

  const user_roles: Row[] = [
    { id: uid(), user_id: "demo-user", role: "super_admin", created_at: now },
    { id: uid(), user_id: "demo-user", role: "admin", created_at: now },
    { id: uid(), user_id: "u-ndong", role: "enseignant", created_at: now },
    { id: uid(), user_id: "u-mboumba", role: "enseignant", created_at: now },
  ];

  const classes: Row[] = [
    { id: "c-6e-a", name: "6e A", level: "6e", school_year: SCHOOL_YEAR, capacity: 40, room: "B12", main_teacher_id: null, created_at: now },
    { id: "c-6e-b", name: "6e B", level: "6e", school_year: SCHOOL_YEAR, capacity: 40, room: "B13", main_teacher_id: null, created_at: now },
    { id: "c-5e-a", name: "5e A", level: "5e", school_year: SCHOOL_YEAR, capacity: 38, room: "A10", main_teacher_id: null, created_at: now },
    { id: "c-3e-a", name: "3e A", level: "3e", school_year: SCHOOL_YEAR, capacity: 35, room: "A08", main_teacher_id: null, created_at: now },
    { id: "c-1ere", name: "1ère C", level: "1ère", school_year: SCHOOL_YEAR, capacity: 30, room: "C01", main_teacher_id: null, created_at: now },
    { id: "c-terminale", name: "Tle D", level: "Tle", school_year: SCHOOL_YEAR, capacity: 32, room: "C02", main_teacher_id: null, created_at: now },
  ];

  const subjects: Row[] = [
    { id: "s-math", name: "Mathématiques", code: "MATH", coefficient: 4, level: "Tous", color: "#7c3aed", created_at: now },
    { id: "s-fr", name: "Français", code: "FR", coefficient: 3, level: "Tous", color: "#0ea5e9", created_at: now },
    { id: "s-pc", name: "Physique-Chimie", code: "PC", coefficient: 3, level: "Secondaire", color: "#e11d48", created_at: now },
    { id: "s-svt", name: "SVT", code: "SVT", coefficient: 2, level: "Tous", color: "#10b981", created_at: now },
    { id: "s-hg", name: "Histoire-Géographie", code: "HG", coefficient: 2, level: "Tous", color: "#f59e0b", created_at: now },
    { id: "s-ang", name: "Anglais", code: "ANG", coefficient: 2, level: "Tous", color: "#4f46e5", created_at: now },
    { id: "s-eps", name: "EPS", code: "EPS", coefficient: 1, level: "Tous", color: "#06b6d4", created_at: now },
  ];

  const teachers: Row[] = [
    { id: "t1", first_name: "Antoine", last_name: "MBOUMBA", gender: "M", email: "a.mboumba@edusync.ga", phone: "+241 06 12 34 56", subject_names: ["Mathématiques"], hire_date: "2018-09-01", status: "actif", created_at: now },
    { id: "t2", first_name: "Clarisse", last_name: "NDONG", gender: "F", email: "c.ndong@edusync.ga", phone: "+241 06 98 76 54", subject_names: ["Français", "Anglais"], hire_date: "2019-09-01", status: "actif", created_at: now },
    { id: "t3", first_name: "Jean-Pierre", last_name: "OYABI", gender: "M", email: "jp.oyabi@edusync.ga", phone: "+241 06 22 33 44", subject_names: ["Physique-Chimie"], hire_date: "2020-09-01", status: "actif", created_at: now },
    { id: "t4", first_name: "Sylvie", last_name: "MOUELE", gender: "F", email: "s.mouele@edusync.ga", phone: "+241 06 55 66 77", subject_names: ["SVT"], hire_date: "2021-09-01", status: "actif", created_at: now },
  ];

  const firstNamesM = ["Julius", "Lionel", "Christ", "Stevy", "Darwin", "Emmanuel", "Kevin", "Bryann", "Junior", "Rayan"];
  const firstNamesF = ["Grace", "Inès", "Naomi", "Prisca", "Orphée", "Chloé", "Esther", "Mélissa", "Aïsha", "Daniella"];
  const lastNames = ["NKO", "OBAME", "MBA", "ONDO", "EYI", "MOUELE", "NZOGHE", "MBOUMBA", "NDONG", "OYANE"];

  const students: Row[] = Array.from({ length: 36 }).map((_, i) => {
    const isF = i % 3 === 0;
    const fn = (isF ? firstNamesF : firstNamesM)[i % 10];
    const ln = lastNames[i % lastNames.length] + (i > 9 ? ` ${i}` : "");
    const cls = classes[i % classes.length];
    return {
      id: `stu-${i + 1}`,
      first_name: fn,
      last_name: ln,
      gender: isF ? "F" : "M",
      birth_date: `201${Math.floor(2 + (i % 4))}-${String(1 + (i % 12)).padStart(2, "0")}-15`,
      matricule: `EDU-${2025 + i}-${String(100 + i).slice(-3)}`,
      class_id: cls.id,
      parent_name: `${lastNames[(i + 3) % lastNames.length]} Parent`,
      parent_phone: `+241 06 ${String(10 + i).padStart(2, "0")} ${String(20 + i).padStart(2, "0")} ${String(30 + i).padStart(2, "0")}`,
      parent_email: `parent${i + 1}@example.ga`,
      address: `${(i + 1) * 12} Avenue de l'Indépendance, Libreville`,
      school_year: SCHOOL_YEAR,
      status: i === 35 ? "transfere" : "actif",
      created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    };
  });

  const terms = ["P1", "P2", "P3", "T1", "T2"];
  const grades: Row[] = [];
  students.slice(0, 24).forEach((s) => {
    subjects.slice(0, 5).forEach((subj) => {
      terms.forEach((term) => {
        if (Math.random() < 0.35) return;
        const value = Math.round((8 + Math.random() * 10 + (Math.random() > 0.5 ? 1 : -1)) * 4) / 4;
        const v = Math.max(4, Math.min(19.5, value));
        grades.push({
          id: uid(),
          student_id: s.id,
          subject_id: subj.id,
          class_id: s.class_id,
          type: ["controle", "devoir", "composition"][Math.floor(Math.random() * 3)],
          value: v,
          max_value: 20,
          term,
          school_year: SCHOOL_YEAR,
          date: `2026-0${2 + Math.floor(Math.random() * 4)}-${String(5 + Math.floor(Math.random() * 20)).padStart(2, "0")}`,
          appreciation: v >= 16 ? "Excellent" : v >= 12 ? "Bien" : v >= 10 ? "Passable" : "Insuffisant",
          created_at: now,
        });
      });
    });
  });

  const attendance: Row[] = [];
  const today = new Date();
  for (let d = 0; d < 12; d++) {
    const date = new Date(today.getTime() - d * 86_400_000).toISOString().slice(0, 10);
    if (new Date(date).getDay() === 0) continue;
    students.slice(0, 18).forEach((s) => {
      const r = Math.random();
      const status = r > 0.92 ? "absent" : r > 0.88 ? "retard" : r > 0.85 ? "excuse" : "present";
      attendance.push({
        id: uid(),
        student_id: s.id,
        class_id: s.class_id,
        date,
        status,
        reason: status === "absent" ? "Maladie" : status === "retard" ? "Trafic" : null,
        created_at: now,
      });
    });
  }

  const payments: Row[] = students.slice(0, 20).map((s, i) => ({
    id: uid(),
    student_id: s.id,
    amount: [150000, 250000, 300000, 75000][i % 4],
    type: ["scolarite", "inscription", "cantine", "transport"][i % 4],
    method: ["especes", "mobile_money", "virement"][i % 3],
    date: `2026-0${(i % 5) + 1}-${String(5 + (i % 22)).padStart(2, "0")}`,
    month: `2026-0${(i % 6) + 1}`,
    status: i % 5 === 0 ? "en_attente" : i % 7 === 0 ? "partiel" : "paye",
    reference: `REF-${2026}${String(1000 + i).slice(-4)}`,
    note: null,
    created_at: now,
  }));

  const course_sessions: Row[] = [];
  classes.slice(0, 3).forEach((cls) => {
    [1, 2, 3, 4, 5].forEach((day) => {
      if (Math.random() < 0.2) return;
      course_sessions.push({
        id: uid(),
        class_id: cls.id,
        subject_id: subjects[Math.floor(Math.random() * subjects.length)].id,
        teacher_id: teachers[Math.floor(Math.random() * teachers.length)].id,
        day_of_week: day,
        start_time: `${String(7 + Math.floor(rnd(0, 4))).padStart(2, "0")}:00`,
        end_time: `${String(8 + Math.floor(rnd(0, 4))).padStart(2, "0")}:00`,
        room: cls.room,
        created_at: now,
      });
    });
  });

  const d = (offset: number) => new Date(today.getTime() + offset * 86_400_000).toISOString().slice(0, 10);

  const announcements: Row[] = [
    { id: uid(), title: "Rentrée scolaire 2025-2026", body: "La rentrée est fixée au lundi 6 octobre. Les élèves sont priés de se présenter dès 7h30 avec leur matériel complet.", audience: "all", author_name: "Direction", priority: "haute", date: d(-30), created_at: now },
    { id: uid(), title: "Conseil de classe — Trimestre 1", body: "Le conseil de classe se tiendra le vendredi à 15h en salle des professeurs. Présence obligatoire pour les professeurs principaux.", audience: "teachers", author_name: "Direction", priority: "normale", date: d(-2), created_at: now },
    { id: uid(), title: "Sortie pédagogique au Musée des Arts", body: "Une sortie est organisée pour les classes de 6e le mois prochain. Autorisation parentale requise.", audience: "students", author_name: "Mme NDONG", priority: "normale", date: d(-7), created_at: now },
    { id: uid(), title: "Paiement des frais de scolarité", body: "Rappel : le deuxième versement des frais de scolarité est attendu avant la fin du mois. Merci de régulariser votre situation.", audience: "parents", author_name: "Comptabilité", priority: "haute", date: d(-1), created_at: now },
  ];

  const messages: Row[] = [
    { id: uid(), sender_name: "Mme NDONG", recipient_id: "stu-1", recipient_type: "student", subject: "Félicitations pour votre copie", body: "Bonjour, votre devoir de français était excellent. Continuez ainsi !", status: "unread", date: d(-1), created_at: now },
    { id: uid(), sender_name: "M. MBOUMBA", recipient_id: "stu-3", recipient_type: "student", subject: "Soutien en mathématiques", body: "Je propose des séances de soutien le mercredi de 16h à 17h. Pensez à vous inscrire.", status: "read", date: d(-3), created_at: now },
    { id: uid(), sender_name: "Direction", recipient_id: "t2", recipient_type: "teacher", subject: "Réunion pédagogique", body: "Une réunion pédagogique est prévue jeudi à 14h.", status: "unread", date: d(-2), created_at: now },
  ];

  const assignments: Row[] = [
    { id: uid(), title: "Devoir maison n°1 — Équations", subject_id: "s-math", class_id: "c-3e-a", description: "Résoudre les exercices 12 à 18 page 54. Soigner la rédaction.", due_date: d(7), max_score: 20, status: "ouvert", created_at: now },
    { id: uid(), title: "Rédaction — Le héros de votre choix", subject_id: "s-fr", class_id: "c-6e-a", description: "Rédigez un texte de 200 mots présentant un héros réel ou fictif.", due_date: d(3), max_score: 20, status: "ouvert", created_at: now },
    { id: uid(), title: "Exposé — Le système solaire", subject_id: "s-svt", class_id: "c-5e-a", description: "Préparez un exposé de 10 minutes par groupe de 3.", due_date: d(14), max_score: 20, status: "ouvert", created_at: now },
    { id: uid(), title: "Composition de physique", subject_id: "s-pc", class_id: "c-terminale", description: "Composition portant sur les chapitres 1 à 4.", due_date: d(-2), max_score: 20, status: "ferme", created_at: now },
  ];

  const events: Row[] = [
    { id: uid(), title: "Composition du 1er trimestre", type: "examen", start_date: d(10), end_date: d(14), description: "Période de composition pour toutes les classes.", created_at: now },
    { id: uid(), title: "Fête de l'Indépendance", type: "ferie", start_date: d(17), end_date: d(17), description: "Jour férié — établissement fermé.", created_at: now },
    { id: uid(), title: "Réunion des parents", type: "reunion", start_date: d(21), end_date: d(21), description: "Rencontre parents-professeurs à partir de 9h.", created_at: now },
    { id: uid(), title: "Vacances de la Toussaint", type: "conges", start_date: d(30), end_date: d(44), description: "Congé scolaire.", created_at: now },
  ];

  return {
    provinces,
    establishments,
    profiles,
    user_roles,
    classes,
    subjects,
    teachers,
    students,
    grades,
    attendance,
    payments,
    course_sessions,
    announcements,
    messages,
    assignments,
    events,
  };
}

export const SEED_TABLES = [
  "provinces",
  "establishments",
  "profiles",
  "user_roles",
  "classes",
  "subjects",
  "teachers",
  "students",
  "grades",
  "attendance",
  "payments",
  "course_sessions",
  "announcements",
  "messages",
  "assignments",
  "events",
] as const;
