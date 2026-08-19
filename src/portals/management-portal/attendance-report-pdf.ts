import { jsPDF } from "jspdf";

type Report = {
  from: string;
  to: string;
  overallPercentage: number;
  studentCount: number;
  classCount: number;
  classTrends: Array<{ className: string; percentage: number }>;
  students: Array<{
    fullName: string;
    rollNo: string;
    className: string;
    percentage: number;
    present: number;
    late: number;
    absent: number;
  }>;
};

export function exportAttendanceReportPdf(report: Report) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;

  doc.setFontSize(18);
  doc.text("CHITTI Public School — Attendance report", margin, y);
  y += 22;
  doc.setFontSize(10);
  doc.text(`Period ${report.from} to ${report.to}`, margin, y);
  y += 14;
  doc.text(
    `Overall attendance ${report.overallPercentage}% · ${report.studentCount} students · ${report.classCount} classes`,
    margin,
    y,
  );
  y += 26;

  doc.setFontSize(13);
  doc.text("Attendance by class", margin, y);
  y += 16;
  doc.setFontSize(10);
  for (const klass of report.classTrends) {
    doc.text(`${klass.className}`, margin, y);
    doc.text(`${klass.percentage}%`, margin + 160, y, { align: "right" });
    y += 14;
  }

  y += 14;
  doc.setFontSize(13);
  doc.text("Student attendance (lowest first)", margin, y);
  y += 16;
  doc.setFontSize(9);
  doc.text("Student", margin, y);
  doc.text("Roll", margin + 190, y);
  doc.text("Class", margin + 250, y);
  doc.text("%", margin + 330, y, { align: "right" });
  doc.text("P / L / A", margin + 400, y);
  y += 12;

  for (const student of report.students) {
    if (y > 780) {
      doc.addPage();
      y = margin;
    }
    doc.text(student.fullName.slice(0, 30), margin, y);
    doc.text(student.rollNo, margin + 190, y);
    doc.text(student.className, margin + 250, y);
    doc.text(`${student.percentage}`, margin + 330, y, { align: "right" });
    doc.text(`${student.present} / ${student.late} / ${student.absent}`, margin + 400, y);
    y += 13;
  }

  doc.save(`chitti-attendance-report-${report.from}-to-${report.to}.pdf`);
}
