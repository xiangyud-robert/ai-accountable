import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { Checkbox } from 'radix-ui'
import { useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { FormDialog } from '../../components/FormDialog'
import { Field, SelectField, TextArea, TextInput, described } from '../../components/fields'
import { notify } from '../../components/Toaster'
import { changedOnly, showSaveError } from '../../lib/forms'
import type { ActivityType } from '../../lib/types'
import { ACTIVITY_TYPES, localMinute, toApiTime } from './fields'
import { useChangeActivity } from './queries'

const schema = z.object({
  type: z.enum(['note', 'call', 'email']),
  description: z.string().trim().min(1, 'Enter a description.'),
  occurred_at: z.string().min(1, 'Enter the date and time it happened.'),
  follow_up_date: z.string(),
  follow_up_done: z.boolean(),
})
type Values = z.infer<typeof schema>
const ORDER = ['type', 'description', 'occurred_at', 'follow_up_date', 'follow_up_done'] as const

export type EditableActivity = {
  id: number
  type: ActivityType
  description: string
  occurred_at: string
  follow_up_date: string | null
  follow_up_done: boolean
}

type ActivityDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: EditableActivity
}

export function ActivityDialog(props: ActivityDialogProps) {
  return props.open ? <EditDialog {...props} /> : null
}

function EditDialog({ open, onOpenChange, activity }: ActivityDialogProps) {
  const id = useId()
  const change = useChangeActivity()
  const initial: Values = {
    type: activity.type,
    description: activity.description,
    occurred_at: localMinute(activity.occurred_at),
    follow_up_date: activity.follow_up_date ?? '',
    follow_up_done: activity.follow_up_done,
  }
  const { register, handleSubmit, setError, control, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  })
  const error = (field: keyof Values) => formState.errors[field]?.message
  const hasFollowUp = useWatch({ control, name: 'follow_up_date' }) !== ''

  const toBody = (v: Values) => ({
    type: v.type,
    description: v.description.trim(),
    occurred_at: toApiTime(v.occurred_at),
    follow_up_date: v.follow_up_date || null,
    follow_up_done: v.follow_up_date ? v.follow_up_done : false,
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await change.mutateAsync({ id: activity.id, values: changedOnly(toBody(values), toBody(initial)) })
      notify.done('Activity saved')
      onOpenChange(false)
    } catch (e) {
      showSaveError(e, setError, [...ORDER])
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${activity.type}`}
      onSubmit={onSubmit}
      busy={change.isPending}
    >
      <div className="grid grid-cols-[140px_1fr] gap-4">
        <Field id={`${id}-type`} label="Type" error={error('type')}>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <SelectField
                ref={field.ref}
                id={`${id}-type`}
                value={field.value}
                onChange={field.onChange}
                options={ACTIVITY_TYPES}
              />
            )}
          />
        </Field>
        <Field id={`${id}-when`} label="When" error={error('occurred_at')}>
          <TextInput
            type="datetime-local"
            {...described(`${id}-when`, error('occurred_at'))}
            {...register('occurred_at')}
            className="font-mono"
          />
        </Field>
      </div>
      <Field id={`${id}-description`} label="Description" error={error('description')}>
        <TextArea {...described(`${id}-description`, error('description'))} {...register('description')} rows={3} />
      </Field>
      <div className="grid grid-cols-2 items-end gap-4">
        <Field id={`${id}-follow`} label="Follow-up date" optional error={error('follow_up_date')}>
          <TextInput
            type="date"
            {...described(`${id}-follow`, error('follow_up_date'))}
            {...register('follow_up_date')}
            className="font-mono"
          />
        </Field>
        {hasFollowUp && (
          <Controller
            control={control}
            name="follow_up_done"
            render={({ field }) => (
              <div className="flex h-9 items-center gap-2">
                <DoneCheckbox id={`${id}-done`} checked={field.value} onCheckedChange={field.onChange} />
                <label htmlFor={`${id}-done`} className="text-[13px] font-medium">
                  Done
                </label>
              </div>
            )}
          />
        )}
      </div>
    </FormDialog>
  )
}

type DoneCheckboxProps = {
  id?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  describedBy?: string
  disabled?: boolean
}

/** The follow-up's Done checkbox, used in timelines, on the dashboard and in this dialog. */
export function DoneCheckbox({ id, checked, onCheckedChange, label, describedBy, disabled }: DoneCheckboxProps) {
  return (
    <Checkbox.Root
      id={id}
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      className="grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-field bg-panel data-[state=checked]:border-primary-text data-[state=checked]:bg-primary"
    >
      <Checkbox.Indicator>
        <Check aria-hidden size={13} strokeWidth={3} className="text-on-primary" />
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}
