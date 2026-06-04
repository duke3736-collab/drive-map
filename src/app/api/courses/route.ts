import { NextResponse } from "next/server";
import { getCourses } from "@/lib/courses";

export async function GET() {
  try {
    const data = await getCourses();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching courses API:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
