import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useRef } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '../../components/Button'
import { Field, SelectField, TextArea, TextInput, described } from '../../components/fields'
import { notify } from '../../components/Toaster'
import { showSaveError } from '../../lib/forms'
import { ACTIVITY_TYPES, localMinute, toApiTime } from './fields'
import { useLogActivity } from './queries'

const schema = z.object({
  type: z.enum(['note', 'call', 'email']),
  description: z.string().trim().min(1, 'Enter a description.'),
  occurred_at: z.string().min(1, 'Enter the date and time it happened.'),
  follow_up_date: z.string(),
})
type Values = z.infer<typeof schema>
const ORDER = ['type', 'description', 'occurred_at', 'follow_up_date'] as const

const blank = (): Values => ({ type: 'note', description: '', occurred_at: localMinute(), follow_up_date: '' })

/** Logs an activity on the contact or deal whose timeline it sits at the top of. */
export function LogActivityForm({ on }: { on: { contact_id: number } | { deal_id: number } }) {
  const id = useId()
  const log = useLogActivity()
  // "When" starts as the time the form appeared. Left as it is, it's the time of saving.
  const start = useRef(blank())
  const { register, handleSubmit, setError, control, formState, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: start.current,
  })
  const error = (field: keyof Values) => formState.errors[field]?.message

  const onSubmit = handleSubmit(async (values) => {
    const when = values.occurred_at === start.current.occurred_at ? localMinute() : values.occurred_at
    try {
      await log.mutateAsync({
        ...on,
        type: values.type,
        description: values.description.trim(),
        occurred_at: toApiTime(when),
        follow_up_date: values.follow_up_date || null,
      })
      notify.done('Activity logged')
      start.current = blank()
      reset(start.current)
    } catch (e) {
      showSaveError(e, setError, [...ORDER])
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} aria-label="Log activity" className="flex flex-col gap-3 rounded-card bg-page p-4">
      <div className="grid grid-cols-[140px_1fr_1fr] gap-3">
        <Field id={`${id}-type`} label="Type" error={error('type')}>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <SelectField ref={field.ref} id={`${id}-type`} value={field.value} onChange={field.onChange} options={ACTIVITY_TYPES} />
            )}
          />
        </Field>
        <Field id={`${id}-when`} label="When" error={error('occurred_at')}>
          <TextInput type="datetime-local" {...described(`${id}-when`, error('occurred_at'))} {...register('occurred_at')} className="font-mono" />
        </Field>
        <Field id={`${id}-follow`} label="Follow-up date" optional error={error('follow_up_date')}>
          <TextInput type="date" {...described(`${id}-follow`, error('follow_up_date'))} {...register('follow_up_date')} className="font-mono" />
        </Field>
      </div>
      <Field id={`${id}-description`} label="Description" error={error('description')}>
        <TextArea {...described(`${id}-description`, error('description'))} {...register('description')} rows={2} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={log.isPending}>
          Log activity
        </Button>
      </div>
    </form>
  )
}
