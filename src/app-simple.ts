import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { cvParserService } from "./services/cv-parser.service";
import { aiService } from "./services/ai.service";
import { env } from "./config/env";

export const app = new Elysia()
  .use(
    cors({
      origin: (request: Request) => {
        const requestOrigin = request.headers.get("origin");
        if (!requestOrigin) return false;
        // Allow localhost for development
        if (
          requestOrigin.includes("localhost") ||
          requestOrigin.includes("127.0.0.1")
        ) {
          return true;
        }
        if (env.ALLOWED_ORIGINS.includes("*")) return true;
        return env.ALLOWED_ORIGINS.includes(requestOrigin);
      },
      credentials: true,
    })
  )

  // Health check
  .get("/api/health", () => ({
    status: "ok",
    service: "UllGetTheJob API MVP",
  }))

  // 1. Upload and parse CV
  .post(
    "/api/cv/upload",
    async ({ body }) => {
      try {
        const file = (body as any).file as File;

        if (!file) {
          throw new Error("No file provided");
        }

        // Validate file type
        const allowedTypes = [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (
          !allowedTypes.includes(file.type) &&
          !file.name.match(/\.(pdf|doc|docx)$/i)
        ) {
          throw new Error("Invalid file type. Please upload PDF or DOCX");
        }

        // Parse CV
        const parsed = await cvParserService.parseCV(file);

        return {
          success: true,
          cv: parsed,
        };
      } catch (error) {
        console.error("CV upload error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Upload failed",
        };
      }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    }
  )

  // 2. Get demo job (hardcoded for MVP)
  .get("/api/jobs/demo", () => {
    return {
      id: "demo-job-1",
      externalId: "hh-123456",
      title: "Senior Full Stack Developer",
      company: "TechCorp International",
      salary: "200000-300000 RUB",
      area: "Moscow",
      description: `
We are seeking an experienced Full Stack Developer to join our growing team.

Requirements:
- 5+ years of experience with modern web technologies
- Strong proficiency in JavaScript/TypeScript
- Experience with React and Node.js
- Knowledge of PostgreSQL or other relational databases
- Familiarity with Docker and cloud platforms (AWS/GCP)
- Experience with REST API design
- Understanding of CI/CD practices

Responsibilities:
- Design and implement scalable web applications
- Collaborate with cross-functional teams
- Write clean, maintainable code
- Participate in code reviews
- Mentor junior developers

Nice to have:
- Experience with Elixir/Phoenix
- Knowledge of microservices architecture
- Open source contributions
      `.trim(),
      requirements: [
        "JavaScript",
        "TypeScript",
        "React",
        "Node.js",
        "PostgreSQL",
        "Docker",
        "REST API",
        "Git",
      ],
      url: "https://hh.ru/vacancy/123456",
    };
  })

  // 3. Customize CV and generate cover letter
  .post(
    "/api/cv/customize",
    async ({ body, set }) => {
      try {
        const { cv, jobDescription } = body as {
          cv: any;
          jobDescription: string;
        };

        if (!cv || !jobDescription) {
          set.status = 400;
          return {
            success: false,
            error: "Missing CV or job description",
          };
        }

        console.log("Customizing CV with AI...");

        // Generate customized CV
        const customizedCV = await aiService.customizeCV(cv, jobDescription);

        console.log("Generating cover letter...");

        // Generate cover letter
        const coverLetter = await aiService.generateCoverLetter(
          customizedCV,
          jobDescription,
          "TechCorp International"
        );

        return {
          success: true,
          customizedCV,
          coverLetter,
        };
      } catch (error) {
        console.error("Customization error:", error);
        set.status = 500;
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Customization failed",
        };
      }
    },
    {
      body: t.Object({
        cv: t.Any(),
        jobDescription: t.String(),
      }),
    }
  )

  // 4. Submit application to HH.ru via Phoenix Core
  .post(
    "/api/application/submit",
    async ({ body, set }) => {
      try {
        const { jobExternalId, customizedCV, coverLetter } = body as {
          jobExternalId: string;
          customizedCV: any;
          coverLetter: string;
        };

        console.log("Submitting application to Phoenix Core...");

        // Call Phoenix Core orchestrator
        const response = await fetch(
          `${env.CORE_URL}/api/applications/submit`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Core-Secret": env.ORCHESTRATOR_SECRET,
            },
            body: JSON.stringify({
              user_id: "mvp-demo-user",
              job_external_id: jobExternalId,
              customized_cv: customizedCV,
              cover_letter: coverLetter,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Phoenix Core error: ${response.status} - ${errorText}`
          );
        }

        const result = await response.json();

        return {
          success: true,
          result,
          message: "Application submitted successfully!",
        };
      } catch (error) {
        console.error("Submission error:", error);
        set.status = 500;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Submission failed",
        };
      }
    },
    {
      body: t.Object({
        jobExternalId: t.String(),
        customizedCV: t.Any(),
        coverLetter: t.String(),
      }),
    }
  )

  // Error handler
  .onError(({ code, error, set }) => {
    console.error("Server error:", code, error);

    if (code === "VALIDATION") {
      set.status = 400;
      return { success: false, error: "Validation error" };
    }

    set.status = 500;
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    };
  });
