import type { AppRole } from "@/chitti-ai/personas";

/** Shared password for every demo account. Demo data only — not real users. */
export const DEMO_PASSWORD = "Chitti@2026";

export type DemoAccount = {
  role: AppRole;
  email: string;
  name: string;
  detail: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "student",
    email: "harpreet.student@xyzschool.test",
    name: "Harpreet Singh",
    detail: "Class 10-A · Roll 10A-01",
  },
  {
    role: "parent",
    email: "gurmeet.parent@xyzschool.test",
    name: "Gurmeet Singh",
    detail: "Parent of Harpreet Singh (10-A)",
  },
  {
    role: "teacher",
    email: "meera.teacher@xyzschool.test",
    name: "Meera Iyer",
    detail: "Class teacher · Mathematics",
  },
  {
    role: "principal",
    email: "principal@xyzschool.test",
    name: "Dr. S. Ramanathan",
    detail: "Principal · school-wide analytics",
  },
];

export const EXTRA_DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "student",
    email: "divya.student@xyzschool.test",
    name: "Divya Patel",
    detail: "Class 10-A · Roll 10A-02",
  },
  {
    role: "student",
    email: "karthik.student@xyzschool.test",
    name: "Karthik Raman",
    detail: "Class 10-A · Roll 10A-03",
  },
  {
    role: "student",
    email: "priya.student@xyzschool.test",
    name: "Priya Sharma",
    detail: "Class 9-B · Roll 9B-04",
  },
  {
    role: "student",
    email: "rahul.student@xyzschool.test",
    name: "Rahul Sharma",
    detail: "Class 8-A · Roll 8A-01",
  },
  {
    role: "parent",
    email: "nilesh.parent@xyzschool.test",
    name: "Nilesh Patel",
    detail: "Parent of Divya Patel",
  },
  {
    role: "parent",
    email: "sudha.parent@xyzschool.test",
    name: "Sudha Raman",
    detail: "Parent of Karthik Raman",
  },
  {
    role: "parent",
    email: "anita.parent@xyzschool.test",
    name: "Anita Sharma",
    detail: "Parent of Rahul & Priya Sharma",
  },
  {
    role: "teacher",
    email: "arun.teacher@xyzschool.test",
    name: "Arun Deshpande",
    detail: "Science teacher",
  },
  {
    role: "teacher",
    email: "fatima.teacher@xyzschool.test",
    name: "Fatima Khan",
    detail: "English teacher",
  },
  {
    role: "teacher",
    email: "nandini.teacher@xyzschool.test",
    name: "Nandini Rao",
    detail: "Social studies teacher",
  },
];
