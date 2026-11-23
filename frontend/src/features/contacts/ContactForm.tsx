import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormDialog } from '../../components/FormDialog'
import { Field, Picker, SelectField, TextInput, described } from '../../components/fields'
import { notify } from '../../components/Toaster'
import { changedOnly, orNull, showSaveError } from '../../lib/forms'
import { STATUSES } from '../../lib/stages'
import type { ContactRow, Status } from '../../lib/types'
import { useOrganizations } from '../organizations/queries'
import { useSaveContact } from './queries'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name.'),
  email: z.string(),
  phone: z.string(),
  job_title: z.string(),
  organization_id: z.number().nullable(),
  status: z.enum(['lead', 'qualified', 'customer']),
})
type Values = z.infer<typeof schema>
const ORDER = ['name', 'email', 'phone', 'job_title', 'organization_id', 'status'] as const

type ContactFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: ContactRow
  /** For a new contact, such as the organization whose page it was added from. */
  defaults?: { organization_id?: number | null; status?: Status }
  onSaved?: (contact: ContactRow) => void
}

export function ContactForm(props: ContactFormProps) {
  return props.open ? <ContactDialog {...props} /> : null
}

function ContactDialog({ open, onOpenChange, contact, defaults, onSaved }: ContactFormProps) {
  const id = useId()
  const save = useSaveContact()
  const { data: organizations = [] } = useOrganizations()

  const initial: Values = {
    name: contact?.name ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    job_title: contact?.job_title ?? '',
    organization_id: contact ? contact.organization_id : (defaults?.organization_id ?? null),
    status: contact?.status ?? defaults?.status ?? 'lead',
  }
  const { register, handleSubmit, setError, control, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  })
  const error = (field: keyof Values) => formState.errors[field]?.message
  const toBody = (v: Values) => ({
    name: v.name.trim(),
    email: orNull(v.email),
    phone: orNull(v.phone),
    job_title: orNull(v.job_title),
    organization_id: v.organization_id,
    status: v.status,
  })

  const onSubmit = handleSubmit(async (values) => {
    const body = toBody(values)
    try {
      const saved = await save.mutateAsync({ id: contact?.id, values: contact ? changedOnly(body, toBody(initial)) : body })
      notify.done('Contact saved')
      onSaved?.(saved)
      onOpenChange(false)
    } catch (e) {
      showSaveError(e, setError, [...ORDER])
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={contact ? 'Edit contact' : 'Add contact'} onSubmit={onSubmit} busy={save.isPending}>
      <Field id={`${id}-name`} label="Name" error={error('name')}>
        <TextInput {...described(`${id}-name`, error('name'))} {...register('name')} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id={`${id}-email`} label="Email" optional error={error('email')}>
          <TextInput type="email" {...described(`${id}-email`, error('email'))} {...register('email')} autoComplete="off" />
        </Field>
        <Field id={`${id}-phone`} label="Phone" optional error={error('phone')}>
          <TextInput type="tel" {...described(`${id}-phone`, error('phone'))} {...register('phone')} autoComplete="off" />
        </Field>
      </div>
      <Field id={`${id}-job`} label="Job title" optional error={error('job_title')}>
        <TextInput {...described(`${id}-job`, error('job_title'))} {...register('job_title')} autoComplete="off" />
      </Field>
      <Field id={`${id}-org`} label="Organization" optional error={error('organization_id')}>
        <Controller
          control={control}
          name="organization_id"
          render={({ field }) => (
            <Picker
              ref={field.ref}
              id={`${id}-org`}
              value={field.value}
              onChange={field.onChange}
              options={organizations.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Choose an organization"
              noneLabel="No organization"
              invalid={!!error('organization_id')}
              describedBy={error('organization_id') ? `${id}-org-error` : undefined}
            />
          )}
        />
      </Field>
      <Field id={`${id}-status`} label="Status" error={error('status')}>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <SelectField
              ref={field.ref}
              id={`${id}-status`}
              value={field.value}
              onChange={field.onChange}
              options={STATUSES.map((s) => ({ value: s.key, label: s.name }))}
            />
          )}
        />
      </Field>
    </FormDialog>
  )
}
