import type { Express, Request, Response } from "express";
import { generateEnrollmentLink, getAllCarrierEnrollmentInfo } from "../services/enrollment-links.service";

export function registerEnrollmentLinkRoutes(app: Express) {
  /**
   * GET /api/enrollment-link?carrier={name}&state={ST}&zip={zip}
   *
   * Get enrollment link for a specific carrier.
   */
  app.get("/api/enrollment-link", async (req: Request, res: Response) => {
    try {
      const carrier = req.query.carrier as string | undefined;
      const state = req.query.state as string | undefined;
      const zip = req.query.zip as string | undefined;

      if (!carrier) {
        return res.status(400).json({ error: "carrier query parameter is required" });
      }

      const result = generateEnrollmentLink(carrier, state, zip);
      res.json(result);
    } catch (err: any) {
      console.error("Error getting enrollment link:", err.message);
      res.status(500).json({ error: "Failed to get enrollment link" });
    }
  });

  /**
   * GET /api/enrollment-links
   *
   * Get all known carrier enrollment info.
   */
  app.get("/api/enrollment-links", async (_req: Request, res: Response) => {
    try {
      const carriers = getAllCarrierEnrollmentInfo();
      res.json(carriers);
    } catch (err: any) {
      console.error("Error getting enrollment links:", err.message);
      res.status(500).json({ error: "Failed to get enrollment links" });
    }
  });
}
