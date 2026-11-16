import type { AvatarCropResult } from '../components/forms/AvatarCropDialog'
import { GHANA_BANKS } from '../utils/ghanaBanks'
import { SellerOnboardingLayout } from '../components/marketplace/SellerOnboardingLayout'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ButtonLink, Icon, AvatarCropDialog, InlineNotice, SelectControl, StatePanel, StepIndicator } from '../components'
import { ErrorSummary, SubmitButton } from '../components/forms/FormControls'
import { FormField, TextAreaField, TextField } from '../components/forms/FormField'
import { FormActions, FormPage, FormSection } from '../components/forms/FormLayout'
import { UnsavedChangesGuard } from '../components/forms/UnsavedChangesGuard'
import { useLocalDraft } from '../components/forms/useLocalDraft'
import { useAuth } from '../hooks/useAuth'
import { apiPost } from '../lib/api'
import type { Shop } from '../types/api'
import { getErrorMessage } from '../utils/errorMessage'
import { canonicalGhanaRegion, GHANA_REGIONS } from '../utils/ghanaRegions'
import { normalizePhone } from '../utils/formValidation'
import { navigateTo } from '../utils/navigation'
import { navigateWithFlash } from '../utils/navigationFlash'

const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp'

function appendText(formData: FormData, name: string, value: FormDataEntryValue | null) {
  const text = String(value || '').trim()
  if (text) formData.append(name, text)
}

export function OpenShopPage() {
  const { refreshUser, user } = useAuth()
  const kycStatus = user?.kycId && typeof user.kycId === 'object' ? user.kycId.status : undefined
  const headingRef = useRef<HTMLDivElement>(null)
  const [assets, setAssets] = useState<Partial<Record<'logo' | 'banner', AvatarCropResult & { output: File; url: string }>>>({})
  const assetsRef = useRef(assets)
  useEffect(() => { assetsRef.current = assets }, [assets])
  useEffect(() => () => { Object.values(assetsRef.current).forEach((asset) => URL.revokeObjectURL(asset.url)) }, [])
  const [editor, setEditor] = useState<{ target: 'logo' | 'banner'; file: File; saved?: AvatarCropResult } | null>(null)
  const [error, setError] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopNameTouched, setShopNameTouched] = useState(false)
  const [cityInput, setCityInput] = useState<string>()
  const [cityTouched, setCityTouched] = useState(false)
  const [regionInput, setRegionInput] = useState<string>()
  const [regionTouched, setRegionTouched] = useState(false)
  const [bio, setBio] = useState('')
  const [category, setCategory] = useState('both')
  const [payoutMethod, setPayoutMethod] = useState('mobile_money')
  const [step, setStep] = useState(0)
  const [validationAttempt, setValidationAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const city = cityInput ?? user?.location?.city?.trim() ?? ''
  const region = regionInput ?? canonicalGhanaRegion(user?.location?.region)
  const hasLegacyRegion = Boolean(region && !GHANA_REGIONS.some((option) => option === region))
  const shopNameValid = shopName.trim().length >= 2
  const cityValid = city.trim().length >= 2
  const regionValid = region.trim().length >= 2
  const canSubmit = shopNameValid && cityValid && regionValid
  const shopNameInvalid = shopNameTouched && !shopNameValid
  const cityInvalid = cityTouched && !cityValid
  const regionInvalid = regionTouched && !regionValid
  const validationErrors = [
    ...(!shopNameValid ? [{ fieldId: 'shop-name', message: 'Enter a shop name with at least 2 characters.' }] : []),
    ...(!cityValid ? [{ fieldId: 'shop-city', message: 'Enter a city or town with at least 2 characters.' }] : []),
    ...(!regionValid ? [{ fieldId: 'shop-region', message: 'Select a region.' }] : []),
  ]
  const draftValue = useMemo(() => ({ bio, category, city, region, shopName }), [bio, category, city, region, shopName])
  const draft = useLocalDraft({
    formId: 'open-shop',
    onRestore: (saved) => {
      if (typeof saved.shopName === 'string') setShopName(saved.shopName)
      if (typeof saved.bio === 'string') setBio(saved.bio)
      if (typeof saved.category === 'string') setCategory(saved.category)
      if (typeof saved.city === 'string') setCityInput(saved.city)
      if (typeof saved.region === 'string') setRegionInput(saved.region)
    },
    userId: user?._id,
    value: draftValue,
  })
  const dirty = Boolean(Object.keys(assets).length || shopName || bio || cityInput !== undefined || regionInput !== undefined || category !== 'both')

  useEffect(() => {
    if (user?.hasShop) navigateTo('/manage-shop')
  }, [user?.hasShop])

  function validatePayout(form: HTMLFormElement) {
    for (const name of ['payoutAccountName', payoutMethod === 'mobile_money' ? 'payoutProvider' : 'payoutBankName', 'payoutAccountNumber']) {
      const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null
      if (!field?.value.trim()) {
        setStep(1)
        setError('Enter the account name, select a provider or bank, and enter the account number before continuing.')
        window.requestAnimationFrame(() => { field?.focus(); field?.reportValidity() })
        return false
      }
    }
    setError('')
    return true
  }

  async function createShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      setShopNameTouched(true)
      setCityTouched(true)
      setRegionTouched(true)
      setStep(0)
      setValidationAttempt((attempt) => attempt + 1)
      return
    }
    const form = event.currentTarget
    if (!validatePayout(form)) return
    const sourceData = new FormData(form)
    const formData = new FormData()
    appendText(formData, 'shopName', sourceData.get('shopName'))
    appendText(formData, 'bio', sourceData.get('bio'))
    appendText(formData, 'category', sourceData.get('category'))
    appendText(formData, 'city', sourceData.get('city'))
    appendText(formData, 'region', sourceData.get('region'))
    appendText(formData, 'payoutMethodType', sourceData.get('payoutMethodType'))
    appendText(formData, 'payoutAccountName', sourceData.get('payoutAccountName'))
    appendText(formData, 'payoutProvider', sourceData.get('payoutProvider'))
    appendText(formData, 'payoutAccountNumber', sourceData.get('payoutAccountNumber'))
    appendText(formData, 'payoutBankName', sourceData.get('payoutBankName'))
    appendText(formData, 'payoutBranch', sourceData.get('payoutBranch'))
    if (assets.logo) formData.append('logo', assets.logo.output)
    if (assets.banner) formData.append('banner', assets.banner.output)
    setSubmitting(true)
    setError('')

    try {
      const data = await apiPost<{ shop: Shop }>('/digishops', formData)
      draft.clearDraft()
      await refreshUser()
      navigateWithFlash(`/manage-shop?shop=${data.shop.slug}`, { message: 'Your DigiShop is ready to customize and stock.', title: 'DigiShop opened', tone: 'success' })
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to create shop'))
    } finally {
      setSubmitting(false)
    }
  }

  function continueSetup() {
    if (step === 1 && !validatePayout(document.getElementById('shop-setup-form') as HTMLFormElement)) return
    if (step === 0 && !canSubmit) {
      setShopNameTouched(true); setCityTouched(true); setRegionTouched(true)
      setValidationAttempt((attempt) => attempt + 1)
      return
    }
    setValidationAttempt(0)
    setStep((current) => Math.min(2, current + 1))
    window.requestAnimationFrame(() => headingRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }

  if (!user?.isKycVerified) {
    const kycPending = kycStatus === 'pending'
    return (
      <SellerOnboardingLayout milestone={kycPending ? 1 : 0}>
        <main className="flow-content mx-auto w-full max-w-5xl px-4 py-8 [&.narrow]:max-w-3xl narrow">
          <StatePanel
            action={<ButtonLink to="/kyc">{kycPending ? 'View status' : 'Get verified'}</ButtonLink>}
            body={kycPending
              ? "We're checking your details now — we'll let you know as soon as a decision is ready."
              : 'We ask sellers to verify their identity first — it builds trust with buyers and helps keep everyone on Foose safe.'}
            layout="page"
            title={kycPending ? 'Verification in progress' : 'Seller verification required'}
            tone="permission"
          />
        </main>
      </SellerOnboardingLayout>
    )
  }

  return (
    <SellerOnboardingLayout compactHeading milestone={step === 0 ? 2 : step === 1 ? 3 : 4}>
      <div ref={headingRef} className="flow-content w-full pb-[calc(10rem+env(safe-area-inset-bottom))] sm:pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <FormPage title="Open your DigiShop" width="standard">
          <UnsavedChangesGuard when={dirty && !submitting} />
          {draft.hasRecoverableDraft && (
            <InlineNotice
              action={(
                <div className="flex gap-2">
                  <button className="min-h-11 rounded-lg px-3 font-black text-accent hover:bg-accent-light" onClick={() => draft.resumeDraft()} type="button">Resume</button>
                  <button className="min-h-11 rounded-lg px-3 font-black text-foose-muted hover:bg-foose-surface-low" onClick={() => draft.discardDraft()} type="button">Discard</button>
                </div>
              )}
              title="Resume shop setup?"
            >
              Images and payout details aren’t saved.
            </InlineNotice>
          )}
          <StepIndicator
            current={step}
            label="Shop setup progress"
            onStepChange={(index) => { if (index < step) { setStep(index); window.requestAnimationFrame(() => headingRef.current?.scrollIntoView({ block: 'start' })) } }}
            steps={['Shop details', 'Payout', 'Images & review']}
          />

          <form id="shop-setup-form" className="space-y-5" encType="multipart/form-data" noValidate onSubmit={(event) => void createShop(event)}>
            <ErrorSummary
              errors={step === 0 || step === 2 ? validationErrors : []}
              focus={validationAttempt > 0}
            />

            <div hidden={step !== 0}>
              <FormSection title="Shop details">
                <TextField
                  autoComplete="organization"
                  error={shopNameInvalid ? 'Enter at least 2 characters.' : undefined}
                  id="shop-name"
                  label="Shop name"
                  name="shopName"
                  onBlur={() => setShopNameTouched(true)}
                  onChange={(event) => setShopName(event.target.value)}
                  placeholder="e.g. Accra Vintage Finds"
                  required
                  value={shopName}
                />
                <TextAreaField id="shop-bio" label="Shop bio" maxLength={500} name="bio" onChange={(event) => setBio(event.target.value)} optional placeholder="What do you sell?" rows={3} value={bio} />
                <FormField htmlFor="shop-category" label="Selling type"><SelectControl id="shop-category" name="category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="retail">Retail</option><option value="wholesale">Wholesale (bulk)</option><option value="both">Retail &amp; wholesale</option></SelectControl></FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  autoComplete="address-level2"
                  error={cityInvalid ? 'Enter at least 2 characters.' : undefined}
                  id="shop-city"
                  label="City or town"
                  name="city"
                  onBlur={() => { setCityInput(city); setCityTouched(true) }}
                  onChange={(event) => setCityInput(event.target.value)}
                  placeholder="e.g. Accra"
                  required
                  value={city}
                />
                <FormField error={regionInvalid ? 'Select a region.' : undefined} htmlFor="shop-region" label="Region" required>
                  <SelectControl
                    aria-describedby={regionInvalid ? 'shop-region-error' : undefined}
                    aria-invalid={regionInvalid || undefined}
                    id="shop-region"
                    name="region"
                    onChange={(event) => { setRegionInput(event.target.value); setRegionTouched(true) }}
                    required
                    value={region}
                  >
                    <option value="">Select region</option>
                    {hasLegacyRegion && <option value={region}>{region}</option>}
                    {GHANA_REGIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </SelectControl>
                </FormField>
                </div>
              </FormSection>
            </div>

            <div hidden={step !== 1}>
              <FormSection columns={2} description="Receive payouts here after funds are released. Payout details aren’t saved in drafts." title="Payout details">
                <FormField htmlFor="payout-method" label="Payment method">
                  <SelectControl value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value)} id="payout-method" name="payoutMethodType">
                    <option value="mobile_money">Mobile money</option>
                    <option value="bank_transfer">Bank transfer</option>
                  </SelectControl>
                </FormField>
                <TextField autoComplete="name" defaultValue={user?.name || ''} id="payout-name" label="Account name" name="payoutAccountName" required placeholder="Registered account name" />
                <FormField htmlFor="payout-provider" label={payoutMethod === 'mobile_money' ? 'Provider' : 'Bank'} required>
                  <SelectControl required key={payoutMethod} defaultValue="" id="payout-provider" name={payoutMethod === 'mobile_money' ? 'payoutProvider' : 'payoutBankName'}>
                    <option value="">{payoutMethod === 'mobile_money' ? 'Select provider' : 'Select bank'}</option>
                    {(payoutMethod === 'mobile_money' ? ['MTN', 'Telecel', 'AirtelTigo'] : GHANA_BANKS).map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                  </SelectControl>
                </FormField>
                <TextField key={`number-${payoutMethod}`} autoComplete={payoutMethod === 'mobile_money' ? 'tel' : 'off'} defaultValue={payoutMethod === 'mobile_money' ? user?.phone || '' : ''} id="payout-number" inputMode={payoutMethod === 'mobile_money' ? 'tel' : 'numeric'} label={payoutMethod === 'mobile_money' ? 'Phone number' : 'Account number'} name="payoutAccountNumber" onBlur={(event) => { if (payoutMethod === 'mobile_money') event.currentTarget.value = normalizePhone(event.currentTarget.value) }} required placeholder={payoutMethod === 'mobile_money' ? '0240000000' : 'Bank account number'} />
                {payoutMethod === 'bank_transfer' && <TextField id="payout-branch" label="Branch" name="payoutBranch" optional />}

              </FormSection>
            </div>

            <div hidden={step !== 2}>
              <FormSection columns={2} description="Optional · JPEG, PNG or WebP · Up to 5 MB each" title="Shop images">
                {(['logo', 'banner'] as const).map((target) => <div key={target} className="min-w-0"><label htmlFor={`shop-${target}`} className="mb-2 block text-sm font-bold">Shop {target}</label>{assets[target] && <img alt={`Shop ${target}`} src={assets[target].url} className="mb-2 w-full rounded-xl object-contain" style={{ aspectRatio: target === 'logo' ? 1 : 2.5 }} />}<div className="flex items-center gap-2"><input id={`shop-${target}`} type="file" accept={ACCEPT_IMAGES} className="min-w-0 flex-1 text-[0px] file:min-h-11 file:rounded-xl file:border-0 file:bg-accent-light file:px-3 file:text-sm file:font-bold file:text-accent" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) setEditor({ target, file }) }} />{assets[target] && <><button type="button" className="min-h-11 text-sm font-bold text-accent" onClick={() => setEditor({ target, file: assets[target]!.sourceFile, saved: assets[target] })}>Adjust</button><button type="button" className="min-h-11 text-sm text-foose-muted" onClick={() => { URL.revokeObjectURL(assets[target]!.url); setAssets((current) => { const next = { ...current }; delete next[target]; return next }) }}>Remove</button></>}</div></div>)}
                <div className="form-field-wide rounded-2xl bg-accent-light/55 p-5">
                  <h3 className="mt-2 font-display text-2xl font-semibold text-foose-text">{shopName || 'Your DigiShop'}</h3>
                  <p className="mt-2 text-sm leading-6 text-foose-muted">{city && region ? `${city}, ${region}` : 'Add your location'} · {category === 'both' ? 'Retail and wholesale' : category}</p>
                  {bio && <p className="mt-3 text-sm leading-6 text-foose-text">{bio}</p>}
                </div>
              </FormSection>
            </div>

            {error && <InlineNotice title="DigiShop was not created" tone="error">{error}</InlineNotice>}
            <FormActions fixed bottomNavInset={false}>
              {step === 0 ? <ButtonLink to="/" variant="secondary">Cancel</ButtonLink> : (
                <button className="inline-flex min-h-12 items-center justify-center rounded-xl border border-foose-border bg-foose-surface px-5 text-sm font-bold text-foose-text hover:border-accent hover:text-accent" onClick={() => setStep((current) => Math.max(0, current - 1))} type="button">Back</button>
              )}
              {step < 2 ? (
                <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-black text-white shadow-md shadow-accent/15 hover:bg-accent-hover" onClick={continueSetup} type="button">Continue <Icon name="arrow" /></button>
              ) : (
                <SubmitButton loading={submitting} loadingLabel="Opening DigiShop…">Create DigiShop <Icon name="arrow" /></SubmitButton>
              )}
            </FormActions>
          </form>
          {editor && <AvatarCropDialog open initialFile={editor.file} initialCrop={editor.saved?.cropState} assetLabel={`shop ${editor.target}`} cropShape={editor.target === 'logo' ? 'circle' : 'rectangle'} outputWidth={editor.target === 'logo' ? 512 : 1500} outputHeight={editor.target === 'logo' ? 512 : 600} onCancel={() => setEditor(null)} onApply={(output, result) => { const previous = assets[editor.target]; if (previous) URL.revokeObjectURL(previous.url); setAssets((current) => ({ ...current, [editor.target]: { ...result, output, url: URL.createObjectURL(output) } })); setEditor(null) }} />}

        </FormPage>
      </div>
    </SellerOnboardingLayout>
  )
}
