import { env } from "../config/env";

export interface ParsedCV {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  summary?: string;
  experience?: string;
  education?: string;
  skills?: string[];
  projects?: string;
  fullText: string;
}

export class CVParserService {
  private openRouterKey = env.OPENROUTER_API_KEY;
  private baseURL = "https://openrouter.ai/api/v1/chat/completions";

  async parseCV(file: File, onProgress?: (stage: string) => void): Promise<ParsedCV> {
    onProgress?.('Extracting text from file...')
    const rawText = await this.extractRawText(file);

    onProgress?.('Analyzing with AI...')
    const structured = await this.extractStructureWithAI(rawText);

    onProgress?.('Complete!')
    return structured;
  }

  private async extractRawText(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();

    if (file.type === "application/pdf") {
      return await this.extractPDFText(buffer);
    } else if (file.type.includes("word") || file.name.match(/\.docx?$/i)) {
      return await this.extractDOCXText(buffer);
    } else {
      throw new Error("Unsupported file type");
    }
  }

  private async extractPDFText(buffer: ArrayBuffer): Promise<string> {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({data: buffer});
    const data = await parser.getText();
    return data.text;
  }

  private async extractDOCXText(buffer: ArrayBuffer): Promise<string> {
    // Using mammoth
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return result.value;
  }

  private async extractStructureWithAI(rawText: string): Promise<ParsedCV> {
    const prompt = `
You are a CV/Resume parser. Extract structured information from the following CV text.

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "firstName": "string or null",
  "lastName": "string or null", 
  "email": "string or null",
  "phone": "string or null",
  "title": "string (job title/position) or null",
  "summary": "string (brief professional summary) or null",
  "experience": "string (work experience, detailed) or null",
  "education": "string (education background) or null",
  "skills": ["array", "of", "skills"] or [],
  "projects": "string (notable projects) or null"
}

CV Text:
${rawText}

Extract all available information. If something is missing, use null or empty array.
`;

    try {
      const response = await fetch(this.baseURL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ullgetthejob.com",
          "X-Title": "UllGetTheJob CV Parser",
        },
        body: JSON.stringify({
          model: "anthropic/claude-3.5-sonnet",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("No response from AI");
      }

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Invalid AI response:", content);
        throw new Error("AI returned invalid format");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        ...parsed,
        fullText: rawText,
      };
    } catch (error) {
      console.error("AI parsing failed:", error);
      // Fallback to basic extraction
      return this.basicExtraction(rawText);
    }
  }

  private basicExtraction(text: string): ParsedCV {
    return {
      email: this.extractEmail(text),
      phone: this.extractPhone(text),
      skills: this.extractBasicSkills(text),
      fullText: text,
    };
  }

  private extractEmail(text: string): string | undefined {
    const match = text.match(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
    );
    return match?.[0];
  }

  private extractPhone(text: string): string | undefined {
    const match = text.match(
      /(?:\+?7|8)[\s\-\(\)]*(\d{3})[\s\-\)]*(\d{3})[\s\-]*(\d{2})[\s\-]*(\d{2})/
    );
    if (match) {
      return `+7 ${match[1]} ${match[2]}-${match[3]}-${match[4]}`;
    }
    return undefined;
  }

  private extractBasicSkills(text: string): string[] {
    const commonSkills = [
      "JavaScript",
      "TypeScript",
      "Python",
      "Java",
      "C#",
      "React",
      "Node.js",
      "Angular",
      "Vue",
      "PostgreSQL",
      "MongoDB",
      "Docker",
      "Kubernetes",
      "AWS",
      "Git",
      "HTML",
      "CSS",
    ];
    return commonSkills.filter((skill) =>
      text.toLowerCase().includes(skill.toLowerCase())
    );
  }
}

export const cvParserService = new CVParserService();
