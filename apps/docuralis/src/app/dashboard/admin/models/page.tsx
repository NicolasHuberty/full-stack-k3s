'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import * as Icons from 'lucide-react';

interface LLMModel {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  contextWindow?: number;
  maxTokens?: number;
  inputPrice?: number;
  outputPrice?: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

export default function AdminModelsPage() {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<LLMModel | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/admin/models');
      if (response.ok) {
        const data = await response.json();
        setModels(data);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (model: Partial<LLMModel>) => {
    try {
      const url = model.id ? `/api/admin/models/${model.id}` : '/api/admin/models';
      const method = model.id ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model),
      });

      if (response.ok) {
        fetchModels();
        setIsDialogOpen(false);
        setEditingModel(null);
      }
    } catch (error) {
      console.error('Failed to save model:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;

    try {
      const response = await fetch(`/api/admin/models/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchModels();
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
    }
  };

  const handleToggleActive = async (model: LLMModel) => {
    try {
      const response = await fetch(`/api/admin/models/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !model.isActive }),
      });

      if (response.ok) {
        fetchModels();
      }
    } catch (error) {
      console.error('Failed to toggle model:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Icons.Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">LLM Models</h1>
          <p className="text-muted-foreground">Manage available AI models</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingModel(null)}>
              <Icons.Plus className="h-4 w-4 mr-2" />
              Add Model
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingModel ? 'Edit Model' : 'Add New Model'}</DialogTitle>
              <DialogDescription>
                Configure the LLM model settings
              </DialogDescription>
            </DialogHeader>
            <ModelForm
              model={editingModel}
              onSave={handleSave}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingModel(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {models.map((model) => (
          <Card key={model.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle>{model.displayName}</CardTitle>
                    {model.isDefault && <Badge>Default</Badge>}
                    {!model.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <CardDescription>{model.name} • {model.provider}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={model.isActive}
                    onCheckedChange={() => handleToggleActive(model)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingModel(model);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Icons.Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(model.id)}
                  >
                    <Icons.Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {model.contextWindow && (
                  <div>
                    <div className="text-muted-foreground">Context Window</div>
                    <div className="font-medium">{model.contextWindow.toLocaleString()}</div>
                  </div>
                )}
                {model.maxTokens && (
                  <div>
                    <div className="text-muted-foreground">Max Tokens</div>
                    <div className="font-medium">{model.maxTokens.toLocaleString()}</div>
                  </div>
                )}
                {model.inputPrice && (
                  <div>
                    <div className="text-muted-foreground">Input Price</div>
                    <div className="font-medium">${model.inputPrice}/1M tokens</div>
                  </div>
                )}
                {model.outputPrice && (
                  <div>
                    <div className="text-muted-foreground">Output Price</div>
                    <div className="font-medium">${model.outputPrice}/1M tokens</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
    </DashboardLayout>
  );
}

function ModelForm({
  model,
  onSave,
  onCancel,
}: {
  model: LLMModel | null;
  onSave: (model: Partial<LLMModel>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: model?.name || '',
    displayName: model?.displayName || '',
    provider: model?.provider || 'openai',
    contextWindow: model?.contextWindow || 128000,
    maxTokens: model?.maxTokens || 4096,
    inputPrice: model?.inputPrice || 0,
    outputPrice: model?.outputPrice || 0,
    isActive: model?.isActive ?? true,
    isDefault: model?.isDefault ?? false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(model ? { ...formData, id: model.id } : formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Model Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="gpt-4o-mini"
            required
          />
        </div>
        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="GPT-4o Mini"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="provider">Provider</Label>
        <Input
          id="provider"
          value={formData.provider}
          onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
          placeholder="openai"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contextWindow">Context Window</Label>
          <Input
            id="contextWindow"
            type="number"
            value={formData.contextWindow}
            onChange={(e) => setFormData({ ...formData, contextWindow: parseInt(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="maxTokens">Max Tokens</Label>
          <Input
            id="maxTokens"
            type="number"
            value={formData.maxTokens}
            onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="inputPrice">Input Price ($/1M tokens)</Label>
          <Input
            id="inputPrice"
            type="number"
            step="0.01"
            value={formData.inputPrice}
            onChange={(e) => setFormData({ ...formData, inputPrice: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="outputPrice">Output Price ($/1M tokens)</Label>
          <Input
            id="outputPrice"
            type="number"
            step="0.01"
            value={formData.outputPrice}
            onChange={(e) => setFormData({ ...formData, outputPrice: parseFloat(e.target.value) })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="isDefault"
              checked={formData.isDefault}
              onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
            />
            <Label htmlFor="isDefault">Default</Label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
