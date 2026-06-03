import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyQ-vhk6Kj6uIFyxugwoHC19OU8XIPRzNc8AbMWbJ3AVoCcGjNZBuc_QVMcAsy9qFOwkA/exec";

export async function GET() {
  try {
    // 1. Google Sheet 데이터 fetch (5분 캐싱)
    const res = await fetch(GOOGLE_SHEET_URL, {
      next: { revalidate: 300 }
    });
    
    if (!res.ok) {
      throw new Error("Failed to fetch sheet data from Google");
    }
    
    const rawData = await res.json();
    
    // 2. precalculated_paths.json 로드
    const filePath = path.join(process.cwd(), 'public', 'precalculated_paths.json');
    let precalculatedPaths: Record<string, { distance?: number; duration?: number }> = {};
    
    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        precalculatedPaths = JSON.parse(fileContent);
      }
    } catch (err) {
      console.error("Failed to read precalculated_paths.json", err);
    }
    
    // 3. 데이터 정제 및 병합
    const cleanData = rawData.map((item: any) => {
      const cleanItem: any = {};
      Object.keys(item).forEach(key => {
        const val = item[key];
        cleanItem[key.trim()] = typeof val === 'string' ? val.trim() : val;
      });
      
      const id = cleanItem.id;
      if (id && precalculatedPaths[id]) {
        const pathData = precalculatedPaths[id];
        if (pathData.distance) {
          cleanItem.distance = `${(pathData.distance / 1000).toFixed(1)}km`;
        }
        if (pathData.duration) {
          cleanItem.duration = `약 ${Math.ceil(pathData.duration / 60)}분`;
        }
      }
      
      return cleanItem;
    }).filter((item: any) => item.id && item.id !== "```");
    
    return NextResponse.json(cleanData);
  } catch (error: any) {
    console.error("Error fetching courses:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
