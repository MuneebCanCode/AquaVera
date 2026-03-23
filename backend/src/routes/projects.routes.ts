import { Router, Response } from 'express';
import { createProject, listProjects, getProject, verifyProject, uploadDocument } from '../services/project.service';
import { getProfile } from '../services/auth.service';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { createProjectSchema, verifyProjectSchema } from '../utils/validation';
import { hederaLimiter } from '../middleware/rate-limit';
import { getTopicMessages } from '../hedera/mirror.service';

const router = Router();

// GET /api/projects — List projects (filtered by role)
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const explore = req.query.explore === 'true';
    const filters: Record<string, string | undefined> = {};
    if (req.userRole === 'project_operator' && !explore) filters.ownerId = req.userId;
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.project_type) filters.projectType = req.query.project_type as string;
    if (req.query.water_stress_zone) filters.waterStressZone = req.query.water_stress_zone as string;
    const projects = await listProjects(filters);
    res.json({ success: true, data: projects });
  } catch (err) { next(err); }
});

// GET /api/projects/:id — Project detail
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const project = await getProject(req.params.id);
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
});

// POST /api/projects — Create new water project (operator only)
router.post('/', requireAuth, requireRole('project_operator'), hederaLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = createProjectSchema.parse(req.body);
    const user = await getProfile(req.userId!);
    const project = await createProject(req.userId!, user.hedera_did || '', input);
    res.status(201).json({ success: true, data: project });
  } catch (err) { next(err); }
});


// POST /api/projects/:id/verify — Approve/reject project (verifier only)
router.post('/:id/verify', requireAuth, requireRole('verifier'), hederaLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { approved, verification_notes } = verifyProjectSchema.parse(req.body);
    const user = await getProfile(req.userId!);
    const project = await verifyProject(req.params.id, req.userId!, user.hedera_did || '', approved, verification_notes);
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
});

// GET /api/projects/:id/audit-trail — HCS audit trail for project
router.get('/:id/audit-trail', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const project = await getProject(req.params.id);
    if (!project.hcs_topic_id) {
      res.json({ success: true, data: [] });
      return;
    }
    const limit = parseInt(req.query.limit as string) || 100;
    const messages = await getTopicMessages(project.hcs_topic_id, limit);
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
});

export default router;
