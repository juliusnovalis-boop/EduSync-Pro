import { average, type Grade, type Subject } from "./types";

export type BulletinLine = {
  subject: Subject;
  count: number;
  moyenne: number;
  coefficient: number;
  points: number;
  appreciation: string;
};

/** Notes d'une période donnée ("all" = toute l'année). */
export function filterByTerm<T extends { term: string }>(rows: T[], term: string) {
  return term === "all" ? rows : rows.filter((row) => row.term === term);
}

/** Lignes de bulletin (une par matière notée) pour un élève et une période. */
export function buildBulletinLines(
  grades: Grade[],
  subjects: Subject[],
  studentId: string,
  term: string,
): BulletinLine[] {
  const own = filterByTerm(grades, term).filter((g) => g.student_id === studentId);
  return subjects
    .map((subject) => {
      const subjectGrades = own.filter((g) => g.subject_id === subject.id);
      const moyenne = average(subjectGrades);
      const coefficient = Number(subject.coefficient || 1);
      return {
        subject,
        count: subjectGrades.length,
        moyenne,
        coefficient,
        points: moyenne * coefficient,
        appreciation: subjectGrades.find((g) => g.appreciation)?.appreciation ?? "",
      };
    })
    .filter((line) => line.count > 0);
}

/** Moyenne générale pondérée par les coefficients des matières. */
export function weightedAverage(lines: BulletinLine[]) {
  const totalCoef = lines.reduce((sum, l) => sum + l.coefficient, 0);
  if (!totalCoef) return 0;
  return lines.reduce((sum, l) => sum + l.points, 0) / totalCoef;
}

export type RankedStudent<S extends { id: string }> = {
  student: S;
  moyenne: number;
  count: number;
  rank: number;
};

/** Classement pondéré des élèves sur une période. */
export function rankStudents<S extends { id: string }>(
  students: S[],
  grades: Grade[],
  subjects: Subject[],
  term: string,
): RankedStudent<S>[] {
  const termGrades = filterByTerm(grades, term);
  return students
    .map((student) => ({
      student,
      moyenne: weightedAverage(buildBulletinLines(termGrades, subjects, student.id, "all")),
      count: termGrades.filter((g) => g.student_id === student.id).length,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.moyenne - a.moyenne)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Moyennes par période, utilisable pour les graphiques d'évolution. */
export function averagesByTerm(grades: Grade[], terms: string[]) {
  return terms.map((term) => ({
    term,
    moyenne: Number(average(filterByTerm(grades, term)).toFixed(2)),
    count: filterByTerm(grades, term).length,
  }));
}

/** Génère un CSV simple (séparateur ;) pour l'export. */
export function toCsv(headers: string[], rows: (string | number)[][]) {
  const escape = (cell: string | number) => {
    const value = String(cell ?? "");
    return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(";")).join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
