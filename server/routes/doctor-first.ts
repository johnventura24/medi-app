import type { Express, Request, Response } from "express";
import { doctorFirstMatch } from "../services/doctor-first-match.service";

export function registerDoctorFirstRoutes(app: Express) {
  /**
   * POST /api/doctor-first-match
   *
   * Doctor-first plan matching. Provide doctors and ZIP, get plans
   * ranked by how likely they are to include your doctors.
   */
  app.post("/api/doctor-first-match", async (req: Request, res: Response) => {
    try {
      const { doctors, zip, additionalPreferences } = req.body;

      if (!zip || !/^\d{5}$/.test(zip)) {
        return res.status(400).json({ error: "Valid 5-digit ZIP required" });
      }

      if (!doctors || !Array.isArray(doctors) || doctors.length === 0) {
        return res.status(400).json({ error: "At least one doctor is required" });
      }

      // Validate each doctor entry
      for (const doc of doctors) {
        if (!doc.npi || !doc.name) {
          return res
            .status(400)
            .json({ error: "Each doctor must have an npi and name" });
        }
      }

      if (doctors.length > 10) {
        return res
          .status(400)
          .json({ error: "Maximum 10 doctors per search" });
      }

      const result = await doctorFirstMatch({
        doctors,
        zip,
        additionalPreferences: additionalPreferences
          ? {
              maxPremium:
                additionalPreferences.maxPremium !== undefined
                  ? Number(additionalPreferences.maxPremium)
                  : undefined,
              wantsDental: !!additionalPreferences.wantsDental,
              wantsOtc: !!additionalPreferences.wantsOtc,
            }
          : undefined,
      });

      res.json(result);
    } catch (err: any) {
      console.error("Error in doctor-first match:", err.message);
      res.status(500).json({ error: "Failed to run doctor-first match" });
    }
  });
}
