'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import type { WaterProject, MarketplaceListing } from '@/types';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateListingModal({ onClose, onSuccess }: Props) {
  const [projects, setProjects] = useState<WaterProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<WaterProject[]>('/projects').then((res) => {
      if (res.success && res.data) {
        const active = res.data.filter((p) => p.status === 'active');
        setProjects(active);
        if (active.length > 0) setProjectId(active[0].id);
      }
    });
  }, []);

  const selectedProject = projects.find((p) => p.id === projectId);

  async function handleCreate() {
    if (!projectId || quantity <= 0 || price <= 0) return;
    setLoading(true);
    const res = await api.post<MarketplaceListing>('/marketplace/listings', {
      project_id: projectId,
      quantity_wsc: quantity,
      price_per_wsc_hbar: price,
    });
    setLoading(false);
    if (res.success) {
      toast.success('Listing created');
      onSuccess();
    } else {
      toast.error(res.error?.message || 'Failed to create listing');
    }
  }

  return (
    <Modal open onClose={onClose} title="Create Sell Listing">
      <div className="space-y-4">
        <Select
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          options={projects.map((p) => ({ value: p.id, label: p.project_name }))}
          placeholder="Select project"
        />
        {selectedProject && (
          <p className="text-xs text-gray-500">
            {selectedProject.project_type} · {selectedProject.watershed_name} · {selectedProject.total_wsc_minted} WSC minted
          </p>
        )}
        <Input
          label="Quantity (WSC)"
          type="number"
          min={1}
          value={quantity || ''}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
          placeholder="e.g. 200"
        />
        <Input
          label="Price per WSC (HBAR)"
          type="number"
          min={0.01}
          step={0.01}
          value={price || ''}
          onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
          placeholder="e.g. 12.50"
        />
        <Button loading={loading} onClick={handleCreate} className="w-full" disabled={!projectId || quantity <= 0 || price <= 0}>
          <Plus className="h-4 w-4" /> Create Listing
        </Button>
      </div>
    </Modal>
  );
}
