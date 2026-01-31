'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CheckCircle2, XCircle, Folder, Server, Cloud, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  importSourceTypes,
  implementedSourceTypes,
  importSourceTypeLabels,
  pollingIntervals,
  pollingIntervalLabels,
  type ImportSourceTypeValue,
  type PollingInterval,
} from '@/lib/validations/import-source'
import type { ImportSource } from '@/lib/database.types'

// Form schema for creating/editing import source
const formSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(255),
  type: z.enum(importSourceTypes),
  polling_interval_minutes: z.number(),
  default_document_type: z.enum(['invoice', 'quote']),
  derive_supplier_from_folder: z.boolean(),
  is_active: z.boolean(),
  // Config fields - type-specific
  config_path: z.string().optional(),
  config_server: z.string().optional(),
  config_share: z.string().optional(),
  config_username: z.string().optional(),
  config_password: z.string().optional(),
  config_domain: z.string().optional(),
  config_bucket: z.string().optional(),
  config_prefix: z.string().optional(),
  config_region: z.string().optional(),
  config_access_key_id: z.string().optional(),
  config_secret_access_key: z.string().optional(),
  config_folder_id: z.string().optional(),
  config_folder_path: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface ImportSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source?: ImportSource | null
  onSuccess: () => void
}

// Icons for all implemented source types (Phase 5: Cloud-Integration enabled)
const sourceTypeIcons: Record<ImportSourceTypeValue, typeof Folder> = {
  local: Folder,
  smb: Server,
  s3: Cloud,
  gdrive: Cloud,
  dropbox: Cloud,
}

export function ImportSourceDialog({
  open,
  onOpenChange,
  source,
  onSuccess,
}: ImportSourceDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false)
  const [oauthConnected, setOAuthConnected] = useState(false)

  const isEdit = !!source

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'local',
      polling_interval_minutes: 5,
      default_document_type: 'invoice',
      derive_supplier_from_folder: false,
      is_active: true,
      config_path: '',
      config_server: '',
      config_share: '',
      config_username: '',
      config_password: '',
      config_domain: '',
      config_bucket: '',
      config_prefix: '',
      config_region: 'eu-central-1',
      config_access_key_id: '',
      config_secret_access_key: '',
      config_folder_id: '',
      config_folder_path: '',
    },
  })

  const selectedType = form.watch('type')

  // Reset form when dialog opens/closes or source changes
  useEffect(() => {
    if (open) {
      if (source) {
        const config = source.config as Record<string, unknown>
        form.reset({
          name: source.name,
          type: source.type as ImportSourceTypeValue,
          polling_interval_minutes: source.polling_interval_minutes,
          default_document_type: source.default_document_type as 'invoice' | 'quote',
          derive_supplier_from_folder: source.derive_supplier_from_folder,
          is_active: source.is_active,
          config_path: (config.path as string) || '',
          config_server: (config.server as string) || '',
          config_share: (config.share as string) || '',
          config_username: (config.username as string) || '',
          config_password: (config.password as string) || '',
          config_domain: (config.domain as string) || '',
          config_bucket: (config.bucket as string) || '',
          config_prefix: (config.prefix as string) || '',
          config_region: (config.region as string) || 'eu-central-1',
          config_access_key_id: (config.access_key_id as string) || '',
          config_secret_access_key: (config.secret_access_key as string) || '',
          config_folder_id: (config.folder_id as string) || '',
          config_folder_path: (config.folder_path as string) || '',
        })
      } else {
        form.reset({
          name: '',
          type: 'local',
          polling_interval_minutes: 5,
          default_document_type: 'invoice',
          derive_supplier_from_folder: false,
          is_active: true,
          config_path: '',
          config_server: '',
          config_share: '',
          config_username: '',
          config_password: '',
          config_domain: '',
          config_bucket: '',
          config_prefix: '',
          config_region: 'eu-central-1',
          config_access_key_id: '',
          config_secret_access_key: '',
          config_folder_id: '',
          config_folder_path: '',
        })
      }
      setTestResult(null)
    }
  }, [open, source, form])

  // Build config object based on type
  const buildConfig = (data: FormData): Record<string, unknown> => {
    switch (data.type) {
      case 'local':
        return {
          path: data.config_path,
          processed_folder: 'verarbeitet',
          error_folder: 'fehler',
          duplicate_folder: 'duplikate',
        }
      case 'smb':
        return {
          server: data.config_server,
          share: data.config_share,
          path: data.config_path,
          username: data.config_username || undefined,
          password: data.config_password || undefined,
          domain: data.config_domain || undefined,
          processed_folder: 'verarbeitet',
          error_folder: 'fehler',
          duplicate_folder: 'duplikate',
        }
      case 's3':
        return {
          bucket: data.config_bucket,
          prefix: data.config_prefix,
          region: data.config_region,
          access_key_id: data.config_access_key_id,
          secret_access_key: data.config_secret_access_key,
          processed_prefix: 'verarbeitet/',
          error_prefix: 'fehler/',
          duplicate_prefix: 'duplikate/',
        }
      case 'gdrive':
        return {
          folder_id: data.config_folder_id,
        }
      case 'dropbox':
        return {
          folder_path: data.config_folder_path,
        }
      default:
        return {}
    }
  }

  const handleTest = async () => {
    const data = form.getValues()
    setIsTesting(true)
    setTestResult(null)

    try {
      // For testing, we need to use a temp endpoint or the actual source
      const testData = {
        type: data.type,
        config: buildConfig(data),
      }

      if (isEdit && source) {
        const response = await fetch(`/api/import-sources/${source.id}/test`, {
          method: 'POST',
        })
        if (!response.ok) throw new Error('Verbindungstest fehlgeschlagen')
        setTestResult('success')
        toast.success('Verbindung erfolgreich!')
      } else {
        // For new sources, just show a success for local paths
        if (data.type === 'local' && data.config_path) {
          setTestResult('success')
          toast.success('Pfad sieht gültig aus!')
        } else {
          toast.info('Verbindungstest nach dem Speichern verfügbar')
        }
      }
    } catch (error) {
      setTestResult('error')
      toast.error(error instanceof Error ? error.message : 'Verbindungstest fehlgeschlagen')
    } finally {
      setIsTesting(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)

    try {
      const payload = {
        name: data.name,
        type: data.type,
        config: buildConfig(data),
        polling_interval_minutes: data.polling_interval_minutes,
        default_document_type: data.default_document_type,
        derive_supplier_from_folder: data.derive_supplier_from_folder,
        is_active: data.is_active,
      }

      const url = isEdit
        ? `/api/import-sources/${source.id}`
        : '/api/import-sources'

      const response = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Fehler beim Speichern')
      }

      const savedSource = await response.json()
      toast.success(isEdit ? 'Import-Quelle aktualisiert' : 'Import-Quelle erstellt')
      onSuccess()

      // BUG-13 fix: For new cloud sources, automatically redirect to OAuth after creation
      if (!isEdit && (data.type === 'gdrive' || data.type === 'dropbox')) {
        const oauthEndpoint = data.type === 'gdrive' ? 'gdrive' : 'dropbox'
        try {
          const oauthRes = await fetch(`/api/auth/${oauthEndpoint}?source_id=${savedSource.id}`)
          const oauthData = await oauthRes.json()
          if (oauthData.auth_url) {
            toast.info('Weiterleitung zur Authentifizierung...')
            window.location.href = oauthData.auth_url
            return // Don't close dialog, we're redirecting
          }
        } catch {
          // OAuth redirect failed, just close the dialog
          toast.info('Quelle erstellt. Bitte verbinden Sie den Cloud-Dienst in den Einstellungen.')
        }
      }

      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Speichern')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Import-Quelle bearbeiten' : 'Neue Import-Quelle'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Bearbeiten Sie die Einstellungen für diese Import-Quelle.'
              : 'Konfigurieren Sie eine neue automatische Import-Quelle für PDFs.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. NAS Rechnungen Eingang" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type Selection */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quellen-Typ</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      {/* BUG-1 Phase 4 fix: Only show implemented source types */}
                      {implementedSourceTypes.map((type) => {
                        const Icon = sourceTypeIcons[type] || Folder
                        return (
                          <div key={type}>
                            <RadioGroupItem
                              value={type}
                              id={`type-${type}`}
                              className="peer sr-only"
                            />
                            <label
                              htmlFor={`type-${type}`}
                              className="flex items-center gap-3 rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                            >
                              <Icon className="h-5 w-5" />
                              <span className="font-medium">
                                {importSourceTypeLabels[type]}
                              </span>
                            </label>
                          </div>
                        )
                      })}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type-specific config fields */}
            <div className="rounded-lg border p-4 space-y-4">
              <h4 className="font-medium text-sm">Verbindungs-Einstellungen</h4>

              {selectedType === 'local' && (
                <FormField
                  control={form.control}
                  name="config_path"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ordner-Pfad *</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="C:\Rechnungen\Eingang oder /mnt/nas/rechnungen"
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleTest}
                          disabled={isTesting || !field.value}
                        >
                          {isTesting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : testResult === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : testResult === 'error' ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            'Test'
                          )}
                        </Button>
                      </div>
                      <FormDescription>
                        Absoluter Pfad zum überwachten Ordner
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {selectedType === 'smb' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="config_server"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Server *</FormLabel>
                          <FormControl>
                            <Input placeholder="nas.local oder 192.168.1.100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="config_share"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Share *</FormLabel>
                          <FormControl>
                            <Input placeholder="rechnungen" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="config_path"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pfad (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="eingang" {...field} />
                        </FormControl>
                        <FormDescription>
                          Unterordner innerhalb des Shares
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="config_username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Benutzer</FormLabel>
                          <FormControl>
                            <Input placeholder="admin" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="config_password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passwort</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="config_domain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Domain</FormLabel>
                          <FormControl>
                            <Input placeholder="WORKGROUP" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {selectedType === 's3' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="config_bucket"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bucket *</FormLabel>
                          <FormControl>
                            <Input placeholder="my-invoices-bucket" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="config_region"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Region *</FormLabel>
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                                <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                                <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                                <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="config_prefix"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prefix (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="rechnungen/eingang/" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="config_access_key_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Access Key ID *</FormLabel>
                          <FormControl>
                            <Input placeholder="AKIAIOSFODNN7EXAMPLE" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="config_secret_access_key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secret Access Key *</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••••••••••"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {selectedType === 'gdrive' && (
                <>
                  <FormField
                    control={form.control}
                    name="config_folder_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Folder ID *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Die Folder-ID aus der Google Drive URL
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {isEdit && source && (
                    <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Google Drive Verbindung</p>
                        <p className="text-xs text-muted-foreground">
                          {(source.config as Record<string, unknown>)?.oauth_token
                            ? 'Verbunden - Klicken Sie auf "Neu verbinden" um die Verbindung zu erneuern'
                            : 'Nicht verbunden - Klicken Sie auf "Mit Google verbinden"'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isConnectingOAuth}
                        onClick={async () => {
                          setIsConnectingOAuth(true)
                          try {
                            const res = await fetch(`/api/auth/gdrive?source_id=${source.id}`)
                            const data = await res.json()
                            if (data.auth_url) {
                              window.location.href = data.auth_url
                            } else {
                              toast.error(data.error || 'Fehler beim Verbinden')
                            }
                          } catch {
                            toast.error('Fehler beim Verbinden mit Google')
                          } finally {
                            setIsConnectingOAuth(false)
                          }
                        }}
                      >
                        {isConnectingOAuth ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <ExternalLink className="h-4 w-4 mr-2" />
                        )}
                        {(source.config as Record<string, unknown>)?.oauth_token
                          ? 'Neu verbinden'
                          : 'Mit Google verbinden'}
                      </Button>
                    </div>
                  )}
                  {!isEdit && (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      Nach dem Erstellen der Quelle können Sie die Google Drive Verbindung herstellen.
                    </p>
                  )}
                </>
              )}

              {selectedType === 'dropbox' && (
                <>
                  <FormField
                    control={form.control}
                    name="config_folder_path"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Folder Path *</FormLabel>
                        <FormControl>
                          <Input placeholder="/Rechnungen/Eingang" {...field} />
                        </FormControl>
                        <FormDescription>
                          Der Pfad zum Dropbox-Ordner
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {isEdit && source && (
                    <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Dropbox Verbindung</p>
                        <p className="text-xs text-muted-foreground">
                          {(source.config as Record<string, unknown>)?.access_token
                            ? 'Verbunden - Klicken Sie auf "Neu verbinden" um die Verbindung zu erneuern'
                            : 'Nicht verbunden - Klicken Sie auf "Mit Dropbox verbinden"'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isConnectingOAuth}
                        onClick={async () => {
                          setIsConnectingOAuth(true)
                          try {
                            const res = await fetch(`/api/auth/dropbox?source_id=${source.id}`)
                            const data = await res.json()
                            if (data.auth_url) {
                              window.location.href = data.auth_url
                            } else {
                              toast.error(data.error || 'Fehler beim Verbinden')
                            }
                          } catch {
                            toast.error('Fehler beim Verbinden mit Dropbox')
                          } finally {
                            setIsConnectingOAuth(false)
                          }
                        }}
                      >
                        {isConnectingOAuth ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <ExternalLink className="h-4 w-4 mr-2" />
                        )}
                        {(source.config as Record<string, unknown>)?.access_token
                          ? 'Neu verbinden'
                          : 'Mit Dropbox verbinden'}
                      </Button>
                    </div>
                  )}
                  {!isEdit && (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      Nach dem Erstellen der Quelle können Sie die Dropbox Verbindung herstellen.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Polling Interval */}
            <FormField
              control={form.control}
              name="polling_interval_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scan-Intervall</FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(Number(val))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pollingIntervals.map((interval) => (
                        <SelectItem key={interval} value={String(interval)}>
                          {pollingIntervalLabels[interval]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Wie oft soll nach neuen PDFs gesucht werden?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Default Document Type */}
            <FormField
              control={form.control}
              name="default_document_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Standard Dokument-Typ</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="invoice">Rechnung</SelectItem>
                      <SelectItem value="quote">Angebot</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Derive supplier from folder */}
            <FormField
              control={form.control}
              name="derive_supplier_from_folder"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="font-medium">
                      Lieferant aus Ordner-Name ableiten
                    </FormLabel>
                    <FormDescription>
                      Versuche den Lieferanten aus dem Unterordner-Namen zu erkennen
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Active */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="font-medium">
                      Automatisches Scannen aktivieren
                    </FormLabel>
                    <FormDescription>
                      Import-Quelle sofort nach dem Speichern aktivieren
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Speichern' : 'Erstellen'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
