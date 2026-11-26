import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormDialog } from '../../components/FormDialog'
import { Field, TextArea, TextInput, described } from '../../components/fields'
import { notify } from '../../components/Toaster'
import { changedOnly, orNull, showSaveError } from '../../lib/forms'
import type { OrganizationRow } from '../../lib/types'
import { useOrganizations, useSaveOrganization } from './queries'

export const organizationSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.'),
  website: z.string(),
  industry: z.string(),
  notes: z.string(),
})
type Values = z.infer<typeof organizationSchema>
const ORDER = ['name', 'website', 'industry', 'notes'] as const

type OrganizationFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The organization to edit, or none for a new one. */
  organization?: OrganizationRow
  onSaved?: (organization: OrganizationRow) => void
}

export function OrganizationForm(props: OrganizationFormProps) {
  return props.open ? <OrganizationDialog {...props} /> : null
}

function OrganizationDialog({ open, onOpenChange, organization, onSaved }: OrganizationFormProps) {
  const id = useId()
  const save = useSaveOrganization()
  const { data: organizations = [] } = useOrganizations()
  const industries = [...new Set(organizations.map((o) => o.industry).filter(Boolean))].sort()

  const initial: Values = {
    name: organization?.name ?? '',
    website: organization?.website ?? '',
    industry: organization?.industry ?? '',
    notes: organization?.notes ?? '',
  }
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(organizationSchema),
    defaultValues: initial,
  })
  const error = (field: keyof Values) => formState.errors[field]?.message

  const onSubmit = handleSubmit(async (values) => {
    const body = {
      name: values.name.trim(),
      website: orNull(values.website),
      industry: orNull(values.industry),
      notes: orNull(values.notes),
    }
    const start = {
      name: initial.name,
      website: orNull(initial.website),
      industry: orNull(initial.industry),
      notes: orNull(initial.notes),
    }
    try {
      const saved = await save.mutateAsync({
        id: organization?.id,
        values: organization ? changedOnly(body, start) : body,
      })
      notify.done('Organization saved')
      onSaved?.(saved)
      onOpenChange(false)
    } catch (e) {
      showSaveError(e, setError, [...ORDER])
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={organization ? 'Edit organization' : 'Add organization'}
      onSubmit={onSubmit}
      busy={save.isPending}
    >
      <Field id={`${id}-name`} label="Name" error={error('name')}>
        <TextInput {...described(`${id}-name`, error('name'))} {...register('name')} autoComplete="off" />
      </Field>
      <Field id={`${id}-website`} label="Website" optional error={error('website')}>
        <TextInput
          {...described(`${id}-website`, error('website'))}
          {...register('website')}
          placeholder="example.com"
        />
      </Field>
      <Field id={`${id}-industry`} label="Industry" optional error={error('industry')}>
        <TextInput
          {...described(`${id}-industry`, error('industry'))}
          {...register('industry')}
          list={`${id}-industries`}
          autoComplete="off"
        />
        <datalist id={`${id}-industries`}>
          {industries.map((industry) => (
            <option key={industry} value={industry!} />
          ))}
        </datalist>
      </Field>
      <Field id={`${id}-notes`} label="Notes" optional error={error('notes')}>
        <TextArea {...described(`${id}-notes`, error('notes'))} {...register('notes')} rows={4} />
      </Field>
    </FormDialog>
  )
}
