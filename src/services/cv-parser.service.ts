import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export interface ParsedCV {
  email?: string;
  phone?: string;
  fullText: string;
  experience?: string;
  education?: string;
  skills?: string[];
  projects?: string;
}

export class CVParserService {
  async parseCV(file: File): Promise<ParsedCV> {
    const buffer = await file.arrayBuffer();

    if (file.type === "application/pdf") {
      return this.parsePDF(buffer);
    } else if (
      file.type.includes("word") ||
      file.name.endsWith(".docx") ||
      file.name.endsWith(".doc")
    ) {
      return this.parseDOCX(buffer);
    } else {
      throw new Error(
        "Unsupported file type. Please upload PDF or Word document."
      );
    }
  }

  private async parsePDF(buffer: ArrayBuffer): Promise<ParsedCV> {
    try {
      const input = new Uint8Array(buffer);
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      return this.extractStructuredData(textResult.text);
    } catch (error) {
      console.error("PDF parsing failed:", error);
      throw new Error("Failed to parse PDF file");
    }
  }

  private async parseDOCX(buffer: ArrayBuffer): Promise<ParsedCV> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return this.extractStructuredData(result.value);
    } catch (error) {
      console.error("DOCX parsing failed:", error);
      throw new Error("Failed to parse Word document");
    }
  }

  private extractStructuredData(text: string): ParsedCV {
    // Normalize text - remove extra whitespace and normalize line endings
    const normalizedText = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n\s+/g, "\n")
      .trim();

    return {
      email: this.extractEmail(normalizedText),
      phone: this.extractPhone(normalizedText),
      fullText: normalizedText,
      experience: this.extractSection(normalizedText, [
        "experience",
        "work history",
        "employment",
        "professional experience",
      ]),
      education: this.extractSection(normalizedText, [
        "education",
        "academic",
        "qualification",
        "degree",
      ]),
      skills: this.extractSkills(normalizedText),
      projects: this.extractSection(normalizedText, [
        "projects",
        "portfolio",
        "personal projects",
      ]),
    };
  }

  private extractEmail(text: string): string | undefined {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    return text.match(emailRegex)?.[0];
  }

  private extractPhone(text: string): string | undefined {
    // Match various phone formats: +7 (999) 123-45-67, 8-999-123-45-67, +7 999 123 45 67, etc.
    const phoneRegex =
      /(?:\+?7|8)[\s\-\(\)]*(\d{3})[\s\-\)]*(\d{3})[\s\-]*(\d{2})[\s\-]*(\d{2})/;
    const match = text.match(phoneRegex);
    if (match) {
      return `+7 ${match[1]} ${match[2]}-${match[3]}-${match[4]}`;
    }
    return undefined;
  }

  private extractSection(text: string, keywords: string[]): string {
    // Convert text to lowercase for case-insensitive matching
    const lowerText = text.toLowerCase();

    // Find the start position of the section
    let startPos = -1;
    let earliestPos = text.length;

    for (const keyword of keywords) {
      const pos = lowerText.indexOf(keyword);
      if (pos !== -1 && pos < earliestPos) {
        earliestPos = pos;
      }
    }

    if (earliestPos === text.length) {
      return "";
    }

    startPos = earliestPos;

    // Find the end of the section (next major section or end of text)
    const sectionKeywords = [
      "experience",
      "education",
      "skills",
      "projects",
      "contact",
      "references",
    ];
    let endPos = text.length;

    for (const keyword of sectionKeywords) {
      const pos = lowerText.indexOf(keyword, startPos + 1);
      if (pos !== -1 && pos < endPos) {
        endPos = pos;
      }
    }

    // Extract the section text
    let sectionText = text.substring(startPos, endPos).trim();

    // Clean up the section text
    sectionText = sectionText
      .replace(new RegExp(`^(${keywords.join("|")})\\s*:?\\s*`, "i"), "") // Remove section header
      .trim();

    return sectionText;
  }

  private extractSkills(text: string): string[] {
    // Look for skills section
    const skillsSection = this.extractSection(text, [
      "skills",
      "technologies",
      "tools",
      "competencies",
    ]);

    if (!skillsSection) {
      return [];
    }

    // Extract skills from the section
    const skillPatterns = [
      // Comma or semicolon separated
      /(?:^|[\n;])\s*([^,\n;]+)(?:,|$)/g,
      // Bullet points
      /(?:^|\n)\s*[•\-\*\•]\s*([^\n]+)/g,
      // Skills in parentheses or brackets
      /(?:\(|（)([^）\)]+)(?:\)|）)/g,
    ];

    const skills: string[] = [];

    for (const pattern of skillPatterns) {
      let match;
      while ((match = pattern.exec(skillsSection)) !== null) {
        const skill = match[1].trim();
        if (skill.length > 2 && skill.length < 50) {
          // Filter reasonable skill names
          skills.push(skill);
        }
      }
    }

    // Also look for common tech skills in the entire text
    const commonTechSkills = [
      "JavaScript",
      "TypeScript",
      "Python",
      "Java",
      "C#",
      "C++",
      "PHP",
      "Ruby",
      "Go",
      "Rust",
      "React",
      "Angular",
      "Vue",
      "Node.js",
      "Express",
      "Django",
      "Flask",
      "Spring",
      "Laravel",
      "PostgreSQL",
      "MySQL",
      "MongoDB",
      "Redis",
      "Docker",
      "Kubernetes",
      "AWS",
      "Azure",
      "GCP",
      "HTML",
      "CSS",
      "Sass",
      "Less",
      "Git",
      "Linux",
      "Windows",
      "macOS",
    ];

    const foundSkills = commonTechSkills.filter((skill) =>
      text.toLowerCase().includes(skill.toLowerCase())
    );

    // Combine and deduplicate
    const allSkills = [...new Set([...skills, ...foundSkills])]
      .filter((skill) => skill.length > 0)
      .slice(0, 20); // Limit to top 20 skills

    return allSkills;
  }

  // Helper method to extract name from text
  extractName(text: string): { firstName?: string; lastName?: string } {
    // Look for patterns like "John Doe" or "Doe, John"
    const namePatterns = [
      // "First Last" pattern
      /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/,
      // "Last, First" pattern
      /\b([A-Z][a-z]+),\s*([A-Z][a-z]+)\b/,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2] && text.includes(",")) {
          // Last, First pattern
          return { firstName: match[2], lastName: match[1] };
        } else {
          // First Last pattern
          return { firstName: match[1], lastName: match[2] };
        }
      }
    }

    return {};
  }
}

export const cvParserService = new CVParserService();
