import { SellerOnboardingLayout } from '../components/marketplace/SellerOnboardingLayout'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ButtonLink,
  ErrorSummary,
  FormActions,
  FormField,
  FormPage,
  FormSection,
  ImagePreviewInput,
  InlineNotice,
  LightboxImage,
  SelectControl,
  StatePanel,
  StepIndicator,
  SubmitButton,
  TextField,
} from '../components'
import { FormPageSkeleton } from '../components/operational/OperationalStates'
import { useApiResource } from '../hooks/useApiResource'
import { useAuth } from '../hooks/useAuth'
import { apiPost, apiPut } from '../lib/api'
import type { KycRecord, User } from '../types/api'
import { getErrorMessage } from '../utils/errorMessage'
import { normalizePhone } from '../utils/formValidation'

const ID_TYPES = ['Ghana Card', 'Passport', 'Driving License'] as const
const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp'
const KYC_IMAGE_LIMIT = 10 * 1024 * 1024

function appendValue(formData: FormData, name: string, value: string) {
  const normalized = value.trim()
  if (normalized) formData.append(name, normalized)
}

function useFilePreview() {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null)
  const previewRef = useRef(preview)

  useEffect(() => {
    previewRef.current = preview
  }, [preview])

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current.url)
  }, [])

  function handleFiles(files: File[]) {
    if (preview) URL.revokeObjectURL(preview.url)
    const file = files[0]
    setPreview(file ? { file, url: URL.createObjectURL(file) } : null)
  }

  return { handleFiles, url: preview?.url || '' }
}

function KycForm({ kyc, onSaved, user }: { kyc: KycRecord; onSaved: () => Promise<void>; user: User | null }) {
  const isResubmit = kyc.status === 'rejected'
  const [step, setStep] = useState(0)
  const [idType, setIdType] = useState<string>(kyc.idType || 'Ghana Card')
  const [idNo, setIdNo] = useState(kyc.idNo || '')
  const [dob, setDob] = useState(kyc.dob || '')
  const [phone, setPhone] = useState(kyc.phone || user?.phone || '')
  const [idFiles, setIdFiles] = useState<File[]>([])
  const [selfieFiles, setSelfieFiles] = useState<File[]>([])
  const idPreview = useFilePreview()
  const selfiePreview = useFilePreview()
  const idPreviewUrl = idPreview.url || (isResubmit ? kyc.idImgUrl : '')
  const selfiePreviewUrl = selfiePreview.url || (isResubmit ? kyc.selfieImgUrl : '')

  function handleIdFilesChange(files: File[]) {
    idPreview.handleFiles(files)
    setIdFiles(files)
  }

  function handleSelfieFilesChange(files: File[]) {
    selfiePreview.handleFiles(files)
    setSelfieFiles(files)
  }
  const [attemptedStep, setAttemptedStep] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  const idNoError = attemptedStep === 0 && idNo.trim().length < 2 ? 'Enter your ID number.' : ''
  const dobError = attemptedStep === 0 && !dob ? 'Enter your date of birth.' : ''
  const idImageError = attemptedStep === 1 && !isResubmit && !idFiles.length ? 'Add a clear photo of your ID.' : ''
  const selfieError = attemptedStep === 2 && !isResubmit && !selfieFiles.length ? 'Add a clear selfie of your face.' : ''

  function goToStep(next: number) {
    setAttemptedStep(null)
    setStep(next)
    window.requestAnimationFrame(() => headingRef.current?.focus())
  }

  function continueFromIdentity() {
    setAttemptedStep(0)
    if (!idNo.trim() || !dob) {
      return
    }
    goToStep(1)
  }

  function continueFromDocuments() {
    setAttemptedStep(2)
    if (!isResubmit && !selfieFiles.length) {
      return
    }
    goToStep(3)
  }

  async function submitKyc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || step !== 3) return

    const formData = new FormData()
    appendValue(formData, 'idType', idType)
    appendValue(formData, 'idNo', idNo)
    appendValue(formData, 'dob', dob)
    appendValue(formData, 'phone', phone)
    if (idFiles[0]) formData.append('idImg', idFiles[0])
    if (selfieFiles[0]) formData.append('selfie', selfieFiles[0])

    setSubmitting(true)
    setError('')
    try {
      if (isResubmit) await apiPut<{ kyc: KycRecord }>('/kyc', formData)
      else await apiPost<{ kyc: KycRecord }>('/kyc', formData)
      await onSaved()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to submit KYC'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormPage
      description={isResubmit
        ? "A couple of details need another look before your DigiShop can go live. Update them below and send them back for review."
        : "Seller verification unlocks selling on Foose."}
      eyebrow={`Step ${step + 1} of 4`}
      title={isResubmit ? 'Update your verification' : 'Verify your identity'}
      width="standard"
    >
      <form aria-busy={submitting} className="grid gap-6" encType="multipart/form-data" onSubmit={(event) => void submitKyc(event)}>
        <StepIndicator current={step} label="Verification progress" onStepChange={(next) => { if (next < step) goToStep(next) }} steps={['You', 'ID photo', 'Selfie', 'Review']} />
        <h2 className="sr-only" ref={headingRef} tabIndex={-1}>{step === 0 ? 'About you' : step === 1 ? 'Photos' : 'Review your details'}</h2>

        {isResubmit && kyc.rejectionReason && (
          <InlineNotice title="What to update" tone="warning">{kyc.rejectionReason}</InlineNotice>
        )}

        <FormSection className={step === 0 ? '' : 'hidden'} columns={2} description="Enter these exactly as they appear on your ID." title="About you">
          {(idNoError || dobError) && <ErrorSummary className="form-field-wide" errors={[...(idNoError ? [{ fieldId: 'kyc-id-number', message: idNoError }] : []), ...(dobError ? [{ fieldId: 'kyc-dob', message: dobError }] : [])]} focus />}
          <FormField htmlFor="kyc-id-type" label="ID type" required>
            <SelectControl id="kyc-id-type" name="idType" onChange={(event) => setIdType(event.target.value as typeof idType)} required value={idType}>
              {ID_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </SelectControl>
          </FormField>
          <TextField error={idNoError} id="kyc-id-number" label="ID number" name="idNo" onChange={(event) => setIdNo(event.target.value)} placeholder="GHA-000000000-0" required value={idNo} />
          <TextField error={dobError} id="kyc-dob" label="Date of birth" name="dob" onChange={(event) => setDob(event.target.value)} required type="date" value={dob} />
          <TextField autoComplete="tel" hint="Optional — handy if we ever need to reach you about your verification." id="kyc-phone" inputMode="tel" label="Phone number" name="phone" onBlur={() => setPhone((current) => normalizePhone(current))} onChange={(event) => setPhone(event.target.value)} optional placeholder="0240000000" type="tel" value={phone} />
        </FormSection>

        <FormSection className={step === 1 ? '' : 'hidden'} description="A bright, in-focus photo with all four corners visible works best." title="Photos">
          {(idImageError || selfieError) && <ErrorSummary errors={[...(idImageError ? [{ fieldId: 'kyc-id-image', message: idImageError }] : []), ...(selfieError ? [{ fieldId: 'kyc-selfie', message: selfieError }] : [])]} focus />}
          {isResubmit && (kyc.idImgUrl || kyc.selfieImgUrl) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {kyc.idImgUrl && <LightboxImage alt="Your current ID photo" className="aspect-[4/3] overflow-hidden rounded-xl border border-foose-border [&_img]:h-full [&_img]:w-full [&_img]:object-cover" src={kyc.idImgUrl} />}
              {kyc.selfieImgUrl && <LightboxImage alt="Your current selfie" className="aspect-[4/3] overflow-hidden rounded-xl border border-foose-border [&_img]:h-full [&_img]:w-full [&_img]:object-cover" src={kyc.selfieImgUrl} />}
            </div>
          )}
          <ImagePreviewInput
            accept={ACCEPT_IMAGES}
            aspect="4 / 3"
            error={idImageError}
            hint={isResubmit ? 'Only choose a new file if you want to replace your current ID photo.' : 'JPEG, PNG, or WebP — up to 10MB.'}
            id="kyc-id-image"
            label="Photo of your ID"
            maxBytes={KYC_IMAGE_LIMIT}
            maxFiles={1}
            name="idImg"
            onFilesChange={handleIdFilesChange}
            presentation="preview"
            required={!isResubmit}
          />
        </FormSection>
        <FormSection className={step === 2 ? '' : 'hidden'} title="A clear photo of you" description="Make sure your face is clearly visible in good lighting.">
          <ImagePreviewInput
            accept={ACCEPT_IMAGES}
            aspect="4 / 3"
            error={selfieError}
            hint={isResubmit ? 'Only choose a new file if you want to replace your current selfie.' : 'Just make sure your face is clearly visible '}
            id="kyc-selfie"
            label="Selfie"
            maxBytes={KYC_IMAGE_LIMIT}
            maxFiles={1}
            name="selfie"
            onFilesChange={handleSelfieFilesChange}
            presentation="preview"
            required={!isResubmit}
          />
        </FormSection>

        <FormSection className={step === 3 ? '' : 'hidden'} description="Take a quick look before you send this off." title="Review your details">
          <dl className="grid gap-4 rounded-xl bg-foose-surface-low p-4 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold text-foose-muted">ID type</dt><dd className="mt-1 font-bold text-foose-text">{idType}</dd></div>
            <div><dt className="font-semibold text-foose-muted">ID number</dt><dd className="mt-1 font-bold text-foose-text">{idNo}</dd></div>
            <div><dt className="font-semibold text-foose-muted">Date of birth</dt><dd className="mt-1 font-bold text-foose-text">{dob}</dd></div>
            <div><dt className="font-semibold text-foose-muted">Phone</dt><dd className="mt-1 font-bold text-foose-text">{phone || 'Not provided'}</dd></div>
          </dl>
          <div className="grid max-w-md grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-foose-muted">ID photo</p>
              {idPreviewUrl ? (
                <div className="aspect-[4/3] overflow-hidden rounded-xl border border-foose-border bg-foose-surface-mid [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
                  <LightboxImage alt="Your ID photo" src={idPreviewUrl} />
                </div>
              ) : (
                <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-foose-border px-2 text-center text-xs font-semibold text-foose-faint">Keeping current upload</div>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-foose-muted">Selfie</p>
              {selfiePreviewUrl ? (
                <div className="aspect-[4/3] overflow-hidden rounded-xl border border-foose-border bg-foose-surface-mid [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
                  <LightboxImage alt="Your selfie" src={selfiePreviewUrl} />
                </div>
              ) : (
                <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-foose-border px-2 text-center text-xs font-semibold text-foose-faint">Keeping current upload</div>
              )}
            </div>
          </div>
          <button className="min-h-11 text-sm font-bold text-accent" onClick={() => goToStep(0)} type="button">Edit identity details</button>
          <InlineNotice tone="info">By submitting, you’re confirming these details are accurate and agreeing to let us use them to verify your identity.</InlineNotice>
          {error && <InlineNotice title="Verification was not submitted" tone="error">{error}</InlineNotice>}
        </FormSection>

        <FormActions bottomNavInset={false} sticky>
          {step > 0 && <button className="inline-flex min-h-12 items-center justify-center rounded-xl border border-foose-border bg-foose-surface px-5 text-sm font-bold text-foose-text hover:border-accent hover:text-accent" disabled={submitting} onClick={() => goToStep(step - 1)} type="button">Back</button>}
          {step === 0 && <button className="inline-flex min-h-12 items-center justify-center rounded-xl border border-accent bg-accent px-5 text-sm font-bold text-white hover:bg-accent-hover" onClick={continueFromIdentity} type="button">Continue to photos</button>}
          {step === 1 && <button className="inline-flex min-h-12 items-center justify-center rounded-xl border border-accent bg-accent px-5 text-sm font-bold text-white hover:bg-accent-hover" onClick={() => { setAttemptedStep(1); if (isResubmit || idFiles.length) goToStep(2) }} type="button">Continue to selfie</button>}
          {step === 2 && <button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-white" onClick={continueFromDocuments} type="button">Review details</button>}
          {step === 3 && <SubmitButton loading={submitting} loadingLabel="Submitting verification…">{isResubmit ? 'Resubmit verification' : 'Submit verification'}</SubmitButton>}
        </FormActions>
      </form>
    </FormPage>
  )
}

export function KycPage() {
  const { user } = useAuth()
  const resource = useApiResource<{ kyc: KycRecord }>('/kyc/me')
  const [started, setStarted] = useState(false)
  const record = resource.data?.kyc

  return (
    <SellerOnboardingLayout milestone={record?.status === 'pending' || record?.status === 'approved' ? 1 : 0}>
        {resource.initialLoading && <FormPageSkeleton label="Loading your verification" media />}
        {resource.error && !record && <StatePanel action={<button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" onClick={() => void resource.refetch()} type="button">Try again</button>} body={resource.error} layout="page" title="We couldn't load your verification" tone="error" />}
        {record?.status === 'approved' && <StatePanel action={<ButtonLink to="/open-shop">Open DigiShop</ButtonLink>} body="Nice — you're all set. You can now open and manage a DigiShop." layout="page" title="You're verified" tone="success" />}
        {record?.status === 'pending' && <StatePanel body="We're checking your details now — we'll let you know as soon as a decision is ready." layout="page" title="We're reviewing your documents" tone="info" />}
        {record?.status === 'not_submitted' && !started && <FormPage eyebrow="Your seller journey" title="Your finds. Your DigiShop." description="Verify your identity, then create a home for your thrift finds on Foose."><FormSection title="What you’ll need"><p className="text-sm leading-7 text-foose-muted">Have your Ghana Card, passport or driving license and a clear selfie ready. Foose reviews your submission before shop setup unlocks.</p><button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-white" onClick={() => setStarted(true)} type="button">Get verified</button></FormSection></FormPage>}
        {record && (record.status === 'rejected' || (record.status === 'not_submitted' && started)) && <KycForm key={`${record.status}:${record.submissionCount || 0}`} kyc={record} onSaved={resource.refetch} user={user} />}
    </SellerOnboardingLayout>
  )
}
