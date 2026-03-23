import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from './supabase';
import { createTopic, submitMessage } from '../hedera/hcs.service';
import { hashData } from '../utils/hashing';
import { createVerificationNotification } from './notification.service';
import type { WaterProject } from '../types';
import type { CreateProjectInput } from '../utils/validation';

/**
 * Create a new water project with HCS topic and audit log.
 */
export async function createProject(
  ownerId: string,
  ownerDid: string,
  input: CreateProjectInput
): Promise<WaterProject> {
  const supabase = getSupabase();

  // Create dedicated HCS topic for this project's sensor data
  const { topicId } = await createTopic(`AquaVera Project: ${input.project_name}`);

  const now = new Date().toISOString();
  const projectId = uuidv4();

  const project: WaterProject = {
    id: projectId,
    owner_id: ownerId,
    project_name: input.project_name,
    project_type: input.project_type,
    description: input.description,
    location_name: input.location_name,
    latitude: input.latitude,
    longitude: input.longitude,
    watershed_name: input.watershed_name,
    water_stress_zone: input.water_stress_zone,
    baseline_daily_liters: input.baseline_daily_liters,
    sensor_types: input.sensor_types,
    status: 'registered',
    guardian_policy_id: null,
    verifier_id: null,
    verification_date: null,
    verification_notes: null,
    hcs_topic_id: topicId,
    total_wsc_minted: 0,
    supporting_documents: null,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from('water_projects').insert(project);
  if (error) throw new Error(error.message);

  // Log registration event to main HCS topic
  const mainTopicId = process.env.HCS_MAIN_TOPIC_ID;
  if (mainTopicId) {
    await submitMessage(mainTopicId, {
      event_type: 'project_registration',
      timestamp: now,
      entity_id: projectId,
      actor_did: ownerDid,
      data_hash: hashData(project),
      metadata: {
        project_type: input.project_type,
        location: input.location_name,
        watershed: input.watershed_name,
        water_stress_zone: input.water_stress_zone,
      },
    });
  }

  return project;
}


/**
 * List projects, optionally filtered by owner.
 */
export async function listProjects(filters?: {
  ownerId?: string;
  status?: string;
  projectType?: string;
  waterStressZone?: string;
}): Promise<WaterProject[]> {
  const supabase = getSupabase();
  let query = supabase.from('water_projects').select('*').order('created_at', { ascending: false });

  if (filters?.ownerId) query = query.eq('owner_id', filters.ownerId);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.projectType) query = query.eq('project_type', filters.projectType);
  if (filters?.waterStressZone) query = query.eq('water_stress_zone', filters.waterStressZone);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as WaterProject[];
}

/**
 * Get a single project by ID.
 */
export async function getProject(projectId: string): Promise<WaterProject> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('water_projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (error || !data) throw new Error(error?.message || 'Project not found');
  return data as WaterProject;
}

/**
 * Verify (approve/reject) a project.
 */
export async function verifyProject(
  projectId: string,
  verifierId: string,
  verifierDid: string,
  approved: boolean,
  notes?: string
): Promise<WaterProject> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const newStatus = approved ? 'active' : 'pending_verification';

  const { data, error } = await supabase
    .from('water_projects')
    .update({
      status: newStatus,
      verifier_id: verifierId,
      verification_date: now,
      verification_notes: notes || null,
      updated_at: now,
    })
    .eq('id', projectId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || 'Failed to update project');

  // Log verification event to main HCS topic
  const mainTopicId = process.env.HCS_MAIN_TOPIC_ID;
  if (mainTopicId) {
    await submitMessage(mainTopicId, {
      event_type: approved ? 'project_verification_approved' : 'project_verification_rejected',
      timestamp: now,
      entity_id: projectId,
      actor_did: verifierDid,
      data_hash: hashData({ projectId, approved, notes }),
      metadata: {
        result: approved ? 'approved' : 'rejected',
        notes: notes || '',
        guardian_policy_file_id: process.env.GUARDIAN_POLICY_FILE_ID || '',
      },
    });
  }

  // Notify project operator
  const { data: projectOwner } = await supabase
    .from('water_projects')
    .select('owner_id, project_name')
    .eq('id', projectId)
    .single();
  if (projectOwner) {
    await createVerificationNotification(projectOwner.owner_id, projectOwner.project_name, approved, notes);
  }

  return data as WaterProject;
}

/**
 * Upload supporting documents to Supabase Storage.
 */
export async function uploadDocument(
  projectId: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getSupabase();
  const path = `projects/${projectId}/${fileName}`;

  const { error } = await supabase.storage
    .from('project-documents')
    .upload(path, fileBuffer, { contentType });
  if (error) throw new Error(error.message);

  // Update project supporting_documents
  const { data: project } = await supabase
    .from('water_projects')
    .select('supporting_documents')
    .eq('id', projectId)
    .single();

  const docs = (project?.supporting_documents as Record<string, unknown>) || {};
  docs[fileName] = path;

  await supabase
    .from('water_projects')
    .update({ supporting_documents: docs, updated_at: new Date().toISOString() })
    .eq('id', projectId);

  return path;
}
