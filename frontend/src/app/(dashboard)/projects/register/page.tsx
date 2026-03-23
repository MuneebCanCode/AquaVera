'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { HashScanLink } from '@/components/ui/HashScanLink';
import { toast } from 'sonner';
import type { WaterProject } from '@/types';

const projectSchema = z.object({
  project_name: z.string().min(3, 'Project name required'),
  project_type: z.enum(['conservation', 'restoration', 'recycling', 'access', 'efficiency'], { required_error: 'Select a project type' }),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  location_name: z.string().min(2, 'Location required'),
  latitude: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  watershed_name: z.string().min(2, 'Watershed name required'),
  water_stress_zone: z.enum(['low', 'medium', 'high', 'extreme'], { required_error: 'Select a stress zone' }),
  baseline_daily_liters: z.coerce.number().positive('Must be positive'),
  sensor_types: z.array(z.string()).min(1, 'Select at least one sensor type'),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const typeOptions = [
  { value: 'conservation', label: 'Conservation' },
  { value: 'restoration', label: 'Restoration' },
  { value: 'recycling', label: 'Recycling' },
  { value: 'access', label: 'Access' },
  { value: 'efficiency', label: 'Efficiency' },
];

const stressOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'extreme', label: 'Extreme' },
];

const sensorOptions = ['flow_meter', 'quality_sensor', 'level_sensor'];

export default function RegisterProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<WaterProject | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: { sensor_types: [] },
  });

  const selectedSensors = watch('sensor_types');

  function toggleSensor(sensor: string) {
    const current = selectedSensors || [];
    const next = current.includes(sensor) ? current.filter((s) => s !== sensor) : [...current, sensor];
    setValue('sensor_types', next, { shouldValidate: true });
  }

  async function onSubmit(data: ProjectFormData) {
    setLoading(true);
    const res = await api.post<WaterProject>('/projects', data);
    setLoading(false);
    if (res.success && res.data) {
      setCreated(res.data);
      toast.success('Project registered successfully');
    } else {
      toast.error(res.error?.message || 'Registration failed');
    }
  }

  if (created) {
    return (
      <Card className="max-w-lg mx-auto text-center">
        <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Project Registered</h2>
        <p className="text-sm text-gray-500 mb-4">{created.project_name} has been registered and an HCS topic created.</p>
        {created.hcs_topic_id && (
          <div className="mb-4">
            <span className="text-sm text-gray-500">HCS Topic: </span>
            <HashScanLink entityType="topic" entityId={created.hcs_topic_id} />
          </div>
        )}
        <div className="flex justify-center gap-3">
          <Button onClick={() => router.push(`/projects/${created.id}`)}>View Project</Button>
          <Button variant="outline" onClick={() => router.push('/projects')}>All Projects</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardTitle>Register Water Project</CardTitle>
      <p className="text-sm text-gray-500 mb-6">Register a new water conservation project to begin earning WSC tokens.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Project Name" {...register('project_name')} error={errors.project_name?.message} placeholder="e.g. Colorado River Restoration" />
        <Select label="Project Type" {...register('project_type')} error={errors.project_type?.message} options={typeOptions} placeholder="Select type" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            {...register('description')}
            rows={3}
            className="input-field"
            placeholder="Describe the water conservation project..."
          />
          {errors.description && <p className="mt-1 text-sm text-danger">{errors.description.message}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Location Name" {...register('location_name')} error={errors.location_name?.message} placeholder="e.g. Grand Junction, CO" />
          <Input label="Watershed Name" {...register('watershed_name')} error={errors.watershed_name?.message} placeholder="e.g. Colorado River Basin" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Latitude" type="number" step="any" {...register('latitude')} error={errors.latitude?.message} placeholder="-90 to 90" />
          <Input label="Longitude" type="number" step="any" {...register('longitude')} error={errors.longitude?.message} placeholder="-180 to 180" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Water Stress Zone" {...register('water_stress_zone')} error={errors.water_stress_zone?.message} options={stressOptions} placeholder="Select zone" />
          <Input label="Baseline Daily Liters" type="number" {...register('baseline_daily_liters')} error={errors.baseline_daily_liters?.message} placeholder="e.g. 50000" />
        </div>

        {/* Sensor Types Multi-Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sensor Types</label>
          <div className="flex flex-wrap gap-2">
            {sensorOptions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSensor(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  selectedSensors?.includes(s)
                    ? 'bg-teal text-white border-teal'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-teal'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
          {errors.sensor_types && <p className="mt-1 text-sm text-danger">{errors.sensor_types.message}</p>}
        </div>

        <Button type="submit" loading={loading} className="w-full">Register Project</Button>
      </form>
    </Card>
  );
}
