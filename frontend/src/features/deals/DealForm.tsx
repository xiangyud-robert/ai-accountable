import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { FormDialog } from '../../components/FormDialog'
import { Field, Picker, SelectField, TextInput, described } from '../../components/fields'
import { notify } from '../../components/Toaster'
import { addDaysISO } from '../../lib/format'
import { changedOnly, showSaveError } from '../../lib/forms'
import { useStages } from '../../lib/stages'
import { teamTodayISO } from '../../lib/teamTime'
import type { DealRow, Stage, StageKey } from '../../lib/types'
import { useContacts } from '../contacts/queries'
import { useOrganizations } from '../organizations/queries'
import { useSaveDeal, type DealValues } from './queries'

// Zod only catches empty required fields and bad numbers. The server checks the rest,
// and its messages are the ones shown (risk 13).
const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name.'),
  organization_id: z.number().nullable(),
  contact_id: z.number().nullable(),
  stage: z.enum(['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']),
  value: z.string().refine((v) => /^\$?\s*[\d,]+$/.test(v.trim()), 'Enter a value from $0 to $100,000,000.'),
  probability: z
    .string()
    .refine((v) => /^\d{1,3}$/.test(v.trim()) && Number(v) <= 100, 'Enter a probability from 0 to 100.'),
  close_date: z.string().min(1, 'Enter a close date.'),
})
type Values = z.infer<typeof schema>
const ORDER = ['name', 'organization_id', 'contact_id', 'stage', 'value', 'probability', 'close_date'] as const

type DealFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  deal?: DealRow
  /** For a new deal: the stage of the column it was added from, and any linked records. */
  defaults?: { stage?: StageKey; organization_id?: number | null; contact_id?: number | null }
  onSaved?: (deal: DealRow) => void
}

export function DealForm(props: DealFormProps) {
  const { data: stages } = useStages()
  return props.open && stages ? <DealDialog {...props} stages={stages} /> : null
}

/** A new deal closes 30 days from today, or today for Won and Lost. */
function newDealCloseDate(stage: Stage) {
  return stage.open ? addDaysISO(teamTodayISO(), 30) : teamTodayISO()
}

function toBody(values: Values): DealValues {
  return {
    name: values.name.trim(),
    organization_id: values.organization_id,
    contact_id: values.contact_id,
    stage: values.stage,
    value: Number(values.value.replace(/[$,\s]/g, '')),
    probability: Number(values.probability),
    close_date: values.close_date,
  }
}

function DealDialog({ open, onOpenChange, deal, defaults, onSaved, stages }: DealFormProps & { stages: Stage[] }) {
  const id = useId()
  const save = useSaveDeal()
  const { data: organizations = [] } = useOrganizations()
  const { data: contacts = [] } = useContacts()
  const stageOf = (key: StageKey) => stages.find((s) => s.key === key)!

  const startStage = stageOf(deal?.stage ?? defaults?.stage ?? 'new')
  const initial: Values = deal
    ? {
        name: deal.name,
        organization_id: deal.organization_id,
        contact_id: deal.contact_id,
        stage: deal.stage,
        value: String(deal.value),
        probability: String(deal.probability),
        close_date: deal.close_date,
      }
    : {
        name: '',
        organization_id: defaults?.organization_id ?? null,
        contact_id: defaults?.contact_id ?? null,
        stage: startStage.key,
        value: '',
        probability: String(startStage.probability),
        close_date: newDealCloseDate(startStage),
      }

  const { register, handleSubmit, setError, control, formState, setValue, getValues } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  })
  const error = (field: keyof Values) => formState.errors[field]?.message
  const stage = stageOf(useWatch({ control, name: 'stage' }))

  // Changing the stage fills in its usual probability, and Won or Lost also fills in
  // today as the close date (R3). Either can still be changed before saving.
  const changeStage = (key: StageKey) => {
    const next = stageOf(key)
    setValue('stage', key, { shouldDirty: true })
    setValue('probability', String(next.probability), { shouldDirty: true, shouldValidate: true })
    if (!next.open) setValue('close_date', teamTodayISO(), { shouldDirty: true })
  }

  // Choosing a main contact fills in the organization if it's empty.
  const changeContact = (contactId: number | null) => {
    setValue('contact_id', contactId, { shouldDirty: true })
    const contact = contacts.find((c) => c.id === contactId)
    if (contact?.organization_id && getValues('organization_id') === null) {
      setValue('organization_id', contact.organization_id, { shouldDirty: true })
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const body = toBody(values)
    const before = toBody(initial)
    // Only what changed is sent. With a new stage, the probability and close date on screen
    // are sent too, even if they match the deal's own, since the server would otherwise fill
    // them in by R3, and the deal would be saved with something other than what was shown.
    const sent = deal
      ? {
          ...changedOnly(body, before),
          ...(body.stage !== before.stage && { probability: body.probability, close_date: body.close_date }),
        }
      : body
    try {
      const saved = await save.mutateAsync({ id: deal?.id, values: sent })
      notify.done('Deal saved')
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
      title={deal ? 'Edit deal' : 'Add deal'}
      onSubmit={onSubmit}
      busy={save.isPending}
    >
      <Field id={`${id}-name`} label="Name" error={error('name')}>
        <TextInput {...described(`${id}-name`, error('name'))} {...register('name')} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
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
        <Field id={`${id}-contact`} label="Main contact" optional error={error('contact_id')}>
          <Controller
            control={control}
            name="contact_id"
            render={({ field }) => (
              <Picker
                ref={field.ref}
                id={`${id}-contact`}
                value={field.value}
                onChange={changeContact}
                options={contacts.map((c) => ({ value: c.id, label: c.name, hint: c.organization_name ?? undefined }))}
                placeholder="Choose a contact"
                noneLabel="No main contact"
                invalid={!!error('contact_id')}
                describedBy={error('contact_id') ? `${id}-contact-error` : undefined}
              />
            )}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field id={`${id}-stage`} label="Stage" error={error('stage')}>
          <Controller
            control={control}
            name="stage"
            render={({ field }) => (
              <SelectField
                ref={field.ref}
                id={`${id}-stage`}
                value={field.value}
                onChange={changeStage}
                options={stages.map((s) => ({ value: s.key, label: s.name }))}
              />
            )}
          />
        </Field>
        <Field id={`${id}-value`} label="Value (USD)" error={error('value')}>
          <TextInput
            inputMode="numeric"
            {...described(`${id}-value`, error('value'))}
            {...register('value')}
            className="font-mono"
            autoComplete="off"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field id={`${id}-probability`} label="Probability (%)" error={error('probability')}>
          {/* Won is always 100% and Lost always 0% (R4), so it can't be edited for them. */}
          <TextInput
            inputMode="numeric"
            readOnly={!stage.open}
            aria-readonly={!stage.open || undefined}
            {...described(`${id}-probability`, error('probability'))}
            {...register('probability')}
            className={`font-mono ${stage.open ? '' : 'bg-page text-ink-muted'}`}
            autoComplete="off"
          />
        </Field>
        <Field id={`${id}-close`} label="Close date" error={error('close_date')}>
          <TextInput
            type="date"
            {...described(`${id}-close`, error('close_date'))}
            {...register('close_date')}
            className="font-mono"
          />
        </Field>
      </div>
    </FormDialog>
  )
}
