import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BsFillSendPlusFill } from 'react-icons/bs'
import { FaAngleRight } from 'react-icons/fa'
import { AppShell, ButtonLink, HashtagInput, Icon, ImagePreviewInput, InlineNotice, LightboxImage, SelectControl, StatePanel, StepIndicator } from '../components'
import { clearDraftImages, loadDraftImages, saveDraftImages } from '../components/forms/draftImageStore'
import { ChoiceCardGroup, ErrorSummary, SubmitButton } from '../components/forms/FormControls'
import { FormField, TextAreaField, TextField } from '../components/forms/FormField'
import { FormActions, FormPage, FormSection } from '../components/forms/FormLayout'
import { ListingColorPicker } from '../components/marketplace/ListingColorPicker'
import { UnsavedChangesGuard } from '../components/forms/UnsavedChangesGuard'
import { useLocalDraft } from '../components/forms/useLocalDraft'
import { FormPageSkeleton } from '../components/operational/OperationalStates'
import { NavigationBackButton } from '../components/navigation'
import { useAuth } from '../hooks/useAuth'
import { useApiResource } from '../hooks/useApiResource'
import { apiPost, apiPut } from '../lib/api'
import type { Listing } from '../types/api'
import { listingColors } from '../utils/listingColors'
import { getErrorMessage } from '../utils/errorMessage'
import { parseGhsToPesewas, priceInputValue } from '../utils/format'
import {
  LISTING_BALE_GRADES,
  LISTING_BRANDS,
  LISTING_CATEGORIES,
  LISTING_COLORS,
  LISTING_CONDITIONS,
  LISTING_FITS,
  LISTING_FOOTWEAR_SIZES,
  LISTING_MATERIALS,
  LISTING_PATTERNS,
  categoryUsesField,
  normalizeCategorySelection,
  optionLabel,
  pruneListingAttributes,
  sizeLabelForCategory,
  sizePlaceholderForCategory,
  type ListingAttributes,
  type ListingColor,
} from '../utils/listingTaxonomy'
import { getCurrentAppPathname } from '../utils/navigation'
import { navigateWithFlash } from '../utils/navigationFlash'

function readFormText(formData: FormData, name: string) {
  return String(formData.get(name) || '').trim()
}

function appendText(formData: FormData, name: string, value: string | number | undefined) {
  if (value === undefined || value === '') return
  formData.append(name, String(value))
}

function taxonomyOptions(options: readonly string[]) {
  return options.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)
}

const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp'
const LISTING_DESCRIPTION_MAX = 500
const listingSelectControl = 'w-full'
const LISTING_COLOR_VALUES = new Set<ListingColor>(LISTING_COLORS.map((color) => color.value))

function initialColorValues(listing?: Listing): ListingColor[] {
  if (!listing) return ['multi']
  const values = listingColors(listing)
  return values.length ? values : listing.type === 'wholesale' ? [] : ['multi']
}

function currentEditId() {
  const match = getCurrentAppPathname().match(/^\/listings\/([^/]+)\/edit/)
  return match ? decodeURIComponent(match[1]).trim() : ''
}

function sourceEventId() {
  return new URLSearchParams(window.location.search).get('eventId')?.trim() || ''
}

export function NewListingPage() {
  const { user } = useAuth()
  const editId = currentEditId()
  const eventId = sourceEventId()
  const editResource = useApiResource<{ listing: Listing }>(editId ? `/listings/${editId}` : null)
  const listing = editResource.data?.listing
  const shopReturnPath = listing?.status === 'draft' ? '/manage-shop/drafts' : '/manage-shop/listings'
  const returnFallback = eventId
    ? { href: `/community/events/${eventId}/manage`, label: 'Event' }
    : listing?.status === 'draft'
      ? { href: '/manage-shop/drafts', label: 'Draft listings' }
      : { href: shopReturnPath, label: 'Active listings' }
  const [error, setError] = useState('')
  const [selectedListingType, setSelectedListingType] = useState<'' | 'retail' | 'wholesale'>('')
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | undefined>(undefined)
  const [selectedCondition, setSelectedCondition] = useState('')
  const [titleValue, setTitleValue] = useState(listing?.title || '')
  const [priceValue, setPriceValue] = useState(listing ? priceInputValue(listing.price) : '')
  const [descriptionValue, setDescriptionValue] = useState(listing?.description || '')
  const [brandValue, setBrandValue] = useState(listing?.brand || '')
  const [colorValues, setColorValues] = useState<ListingColor[]>(initialColorValues(listing))
  const [sizeValue, setSizeValue] = useState(listing?.size || '')
  const [genderValue, setGenderValue] = useState(listing?.gender || '')
  const [bulkWeightValue, setBulkWeightValue] = useState(listing?.bulkWeight || '')
  // Deliberately starts unset on a new listing so the seller has to choose.
  const [bargainingValue, setBargainingValue] = useState<'' | 'yes' | 'no'>(
    listing === undefined ? '' : listing.bargainingAllowed ? 'yes' : 'no',
  )
  const [minAcceptableValue, setMinAcceptableValue] = useState(
    listing?.minAcceptablePrice ? priceInputValue(listing.minAcceptablePrice) : '',
  )
  const [attributeValues, setAttributeValues] = useState<ListingAttributes>(listing?.attributes || {})
  const [flawNoteValue, setFlawNoteValue] = useState('')
  const [hashtags, setHashtags] = useState<string[]>(listing?.hashtags || [])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [selectedPreviews, setSelectedPreviews] = useState<{ file: File; url: string }[]>([])
  const selectedPreviewsRef = useRef(selectedPreviews)
  const [step, setStep] = useState(0)
  const [validationAttempt, setValidationAttempt] = useState(0)
  const restoredRef = useRef(false)
  const [touched, setTouched] = useState({ price: false, title: false })
  const [submitting, setSubmitting] = useState(false)
  const [submittingAction, setSubmittingAction] = useState<'active' | 'draft' | ''>('')
  const listingType = selectedListingType || listing?.type || 'retail'
  const storedSelection = normalizeCategorySelection(listing?.category, listing?.subcategory)
  const categoryValue = selectedCategory ?? storedSelection.category
  const subcategoryValue = selectedSubcategory ?? storedSelection.subcategory
  const conditionValue = selectedCondition || listing?.condition || ''
  const brandOptions = listing?.brand && !LISTING_BRANDS.includes(listing.brand) ? [...LISTING_BRANDS, listing.brand].sort((a, b) => a.localeCompare(b)) : LISTING_BRANDS
  const brandedOptions = brandOptions.filter((brand) => brand !== 'Unbranded').sort((a, b) => a.localeCompare(b))
  const footwearSizeOptions = sizeValue && !LISTING_FOOTWEAR_SIZES.includes(sizeValue)
    ? [...LISTING_FOOTWEAR_SIZES, sizeValue]
    : LISTING_FOOTWEAR_SIZES
  const availableSubcategories = LISTING_CATEGORIES.find((entry) => entry.label === categoryValue)?.subcategories || []
  const needsFlawProof = conditionValue === 'fair' || conditionValue === 'poor'
  const sizePlaceholder = sizePlaceholderForCategory(categoryValue, subcategoryValue)
  // Bales are mixed bundles, not single graded garments, so item-specific
  // attributes stop applying once the listing type is wholesale.
  const HIDDEN_FOR_WHOLESALE = new Set<Parameters<typeof categoryUsesField>[1]>(['size', 'gender', 'brand', 'material', 'fit'])
  const showsField = (field: Parameters<typeof categoryUsesField>[1]) =>
    categoryUsesField(categoryValue, field, subcategoryValue, listingType) &&
    !(listingType === 'wholesale' && HIDDEN_FOR_WHOLESALE.has(field))
  const priceNumber = parseGhsToPesewas(priceValue)
  const categoryMissing = !categoryValue
  const sizeMissing = showsField('size') && !sizeValue.trim()
  const genderMissing = showsField('gender') && !genderValue
  const conditionMissing = listingType !== 'wholesale' && !conditionValue
  // fieldsForCategory() auto-adds baleGrade whenever the listing type is
  // wholesale, so showsField('baleGrade') already scopes this to bales.
  const baleGradeMissing = showsField('baleGrade') && !attributeValues.baleGrade
  const bulkWeightMissing = listingType === 'wholesale' && !bulkWeightValue.trim()
  const bargainingMissing = !bargainingValue
  const minAcceptableNumber = minAcceptableValue.trim() ? parseGhsToPesewas(minAcceptableValue) : null
  const minAcceptableInvalid =
    bargainingValue === 'yes' &&
    minAcceptableValue.trim() !== '' &&
    (minAcceptableNumber === null || minAcceptableNumber <= 0 || (priceNumber !== null && minAcceptableNumber > priceNumber))
  const attributesValid = !categoryMissing && !sizeMissing && !genderMissing && !conditionMissing && !baleGradeMissing && !bulkWeightMissing
  const canSubmitListing = titleValue.trim().length >= 2 && priceNumber !== null && priceNumber >= 0 && attributesValid && !bargainingMissing && !minAcceptableInvalid
  const titleInvalid = touched.title && titleValue.trim().length < 2
  const priceInvalid = touched.price && (priceNumber === null || priceNumber < 0)
  const categoryInvalid = validationAttempt > 0 && categoryMissing
  const sizeInvalid = validationAttempt > 0 && sizeMissing
  const genderInvalid = validationAttempt > 0 && genderMissing
  const conditionInvalid = validationAttempt > 0 && conditionMissing
  const baleGradeInvalid = validationAttempt > 0 && baleGradeMissing
  const bulkWeightInvalid = validationAttempt > 0 && bulkWeightMissing
  const validationErrors = [
    ...(titleValue.trim().length < 2 ? [{ fieldId: 'listing-title', message: 'Enter a listing title with at least 2 characters.' }] : []),
    ...(priceNumber === null || priceNumber < 0 ? [{ fieldId: 'listing-price', message: 'Enter a valid price with up to two decimal places.' }] : []),
    ...(categoryMissing ? [{ fieldId: 'listing-category', message: 'Choose a category.' }] : []),
    ...(sizeMissing ? [{ fieldId: 'listing-size', message: 'Enter a size.' }] : []),
    ...(genderMissing ? [{ fieldId: 'listing-gender', message: 'Choose a gender.' }] : []),
    ...(conditionMissing ? [{ fieldId: 'listing-condition', message: 'Choose a condition.' }] : []),
    ...(baleGradeMissing ? [{ fieldId: 'listing-bale-grade', message: 'Choose a bale grade.' }] : []),
    ...(bulkWeightMissing ? [{ fieldId: 'listing-weight', message: 'Enter the bale weight.' }] : []),
    ...(bargainingMissing ? [{ fieldId: 'listing-bargaining', message: 'Choose whether buyers can send you offers.' }] : []),
    ...(minAcceptableInvalid ? [{ fieldId: 'listing-min-price', message: 'Enter a lowest price above zero and no higher than your listed price.' }] : []),
  ]
  const draftValue = useMemo(() => ({
    bargaining: bargainingValue,
    brand: brandValue,
    bulkWeight: bulkWeightValue,
    minAcceptablePrice: minAcceptableValue,
    attributes: attributeValues,
    category: categoryValue,
    subcategory: subcategoryValue,
    color: colorValues[0],
    colors: colorValues,
    condition: conditionValue,
    description: descriptionValue,
    flawNote: flawNoteValue,
    gender: genderValue,
    hashtags,
    listingType,
    price: priceValue,
    size: sizeValue,
    title: titleValue,
  }), [attributeValues, bargainingValue, brandValue, bulkWeightValue, categoryValue, colorValues, conditionValue, descriptionValue, flawNoteValue, genderValue, hashtags, listingType, minAcceptableValue, priceValue, sizeValue, subcategoryValue, titleValue])
  const draft = useLocalDraft({
    enabled: !editResource.initialLoading,
    formId: 'listing',
    onRestore: (saved) => {
      restoredRef.current = true
      if (saved.listingType === 'retail' || saved.listingType === 'wholesale') setSelectedListingType(saved.listingType)
      if (typeof saved.title === 'string') setTitleValue(saved.title)
      if (typeof saved.description === 'string') setDescriptionValue(saved.description)
      if (typeof saved.price === 'string') setPriceValue(saved.price)
      if (typeof saved.category === 'string') setSelectedCategory(saved.category)
      if (typeof saved.subcategory === 'string') setSelectedSubcategory(saved.subcategory)
      if (typeof saved.brand === 'string') setBrandValue(saved.brand)
      if (typeof saved.condition === 'string') setSelectedCondition(saved.condition)
      if (Array.isArray(saved.colors)) {
        const restoredColors = saved.colors.filter((color): color is ListingColor => LISTING_COLOR_VALUES.has(color as ListingColor)).slice(0, 5)
        setColorValues(restoredColors.length ? restoredColors : saved.listingType === 'wholesale' ? [] : ['multi'])
      }
      else if (typeof saved.color === 'string' && LISTING_COLOR_VALUES.has(saved.color as ListingColor)) setColorValues([saved.color as ListingColor])
      if (typeof saved.size === 'string') setSizeValue(saved.size)
      if (typeof saved.gender === 'string') setGenderValue(saved.gender)
      if (typeof saved.bulkWeight === 'string') setBulkWeightValue(saved.bulkWeight)
      if (saved.bargaining === 'yes' || saved.bargaining === 'no') setBargainingValue(saved.bargaining)
      if (typeof saved.minAcceptablePrice === 'string') setMinAcceptableValue(saved.minAcceptablePrice)
      if (saved.attributes && typeof saved.attributes === 'object' && !Array.isArray(saved.attributes)) setAttributeValues(saved.attributes as ListingAttributes)
      if (typeof saved.flawNote === 'string') setFlawNoteValue(saved.flawNote)
      if (Array.isArray(saved.hashtags)) setHashtags(saved.hashtags.filter((tag): tag is string => typeof tag === 'string'))
    },
    resourceId: editId || 'new',
    userId: user?._id,
    value: draftValue,
  })
  const dirty = listing
    ? titleValue !== (listing.title || '') || descriptionValue !== (listing.description || '') || priceValue !== priceInputValue(listing.price) || categoryValue !== storedSelection.category || subcategoryValue !== storedSelection.subcategory || JSON.stringify(colorValues) !== JSON.stringify(initialColorValues(listing)) || JSON.stringify(attributeValues) !== JSON.stringify(listing.attributes || {}) || selectedFiles.length > 0 || bargainingValue !== (listing.bargainingAllowed ? 'yes' : 'no') || minAcceptableValue !== (listing.minAcceptablePrice ? priceInputValue(listing.minAcceptablePrice) : '')
    : Boolean(titleValue || descriptionValue || priceValue || selectedCategory || brandValue || selectedCondition || hashtags.length || selectedFiles.length || selectedListingType || bargainingValue || (listingType !== 'wholesale' && (colorValues.length !== 1 || colorValues[0] !== 'multi')))

  useEffect(() => {
    selectedPreviewsRef.current = selectedPreviews
  }, [selectedPreviews])

  useEffect(() => () => {
    selectedPreviewsRef.current.forEach((item) => URL.revokeObjectURL(item.url))
  }, [])

  function handleSelectedFilesChange(files: File[]) {
    const previousByFile = new Map(selectedPreviews.map((item) => [item.file, item.url]))
    const nextPreviews = files.map((file) => {
      const existingUrl = previousByFile.get(file)
      if (existingUrl) {
        previousByFile.delete(file)
        return { file, url: existingUrl }
      }
      return { file, url: URL.createObjectURL(file) }
    })
    previousByFile.forEach((url) => URL.revokeObjectURL(url))
    setSelectedPreviews(nextPreviews)
    setSelectedFiles(files)
    void saveDraftImages(draft.storageKey, files)
  }

  function handleResumeDraft() {
    draft.resumeDraft()
    void loadDraftImages(draft.storageKey).then((files) => {
      if (files.length) handleSelectedFilesChange(files)
    })
  }

  function handleDiscardDraft() {
    draft.discardDraft()
    void clearDraftImages(draft.storageKey)
  }

  useEffect(() => {
    if (!listing || restoredRef.current) return
    setTitleValue(listing.title || '')
    setPriceValue(priceInputValue(listing.price))
    setDescriptionValue(listing.description || '')
    const normalizedListingCategory = normalizeCategorySelection(listing.category, listing.subcategory)
    setSelectedCategory(normalizedListingCategory.category)
    setSelectedSubcategory(normalizedListingCategory.subcategory)
    setBrandValue(listing.brand || '')
    setColorValues(initialColorValues(listing))
    setSizeValue(listing.size || '')
    setGenderValue(listing.gender || '')
    setBulkWeightValue(listing.bulkWeight || '')
    setBargainingValue(listing.bargainingAllowed ? 'yes' : 'no')
    setMinAcceptableValue(listing.minAcceptablePrice ? priceInputValue(listing.minAcceptablePrice) : '')
    setAttributeValues(listing.attributes || {})
    setHashtags(listing.hashtags || [])
  }, [listing])

  function changeCategorySelection(category: string, subcategory: string) {
    setSelectedCategory(category)
    setSelectedSubcategory(subcategory)
    setAttributeValues((current) => pruneListingAttributes(category, current, subcategory, listingType))
    if (!categoryUsesField(category, 'brand', subcategory, listingType)) setBrandValue('')
    if (!categoryUsesField(category, 'size', subcategory, listingType)) setSizeValue('')
    if (!categoryUsesField(category, 'gender', subcategory, listingType)) setGenderValue('')
  }

  function changeListingType(type: 'retail' | 'wholesale') {
    setSelectedListingType(type)
    if (type === 'retail' && !colorValues.length) setColorValues(['multi'])
    setAttributeValues((current) => pruneListingAttributes(categoryValue, current, subcategoryValue, type))
  }

  function changeAttribute(name: keyof ListingAttributes, value: string) {
    setAttributeValues((current) => ({ ...current, [name]: value || undefined }))
  }

  function continueListingStep() {
    if (step === 0 && titleValue.trim().length < 2) {
      setTouched((current) => ({ ...current, title: true }))
      setValidationAttempt((attempt) => attempt + 1)
      return
    }
    if (step === 1 && !canSubmitListing) {
      setTouched({ price: true, title: true })
      setValidationAttempt((attempt) => attempt + 1)
      return
    }
    setValidationAttempt(0)
    setStep((current) => Math.min(2, current + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function createListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmitListing) {
      setTouched({ price: true, title: true })
      setStep(titleValue.trim().length < 2 ? 0 : 1)
      setValidationAttempt((attempt) => attempt + 1)
      return
    }
    const form = event.currentTarget
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const requestedStatus = submitter?.dataset.status === 'draft' ? 'draft' : 'active'
    const sourceData = new FormData(form)
    const uploadData = new FormData()
    const price = parseGhsToPesewas(readFormText(sourceData, 'price'))
    const flawNote = readFormText(sourceData, 'flawNote')
    const submittedDescription = readFormText(sourceData, 'description')
    const completeDescription = needsFlawProof ? `${submittedDescription}\n\nFlaws: ${flawNote}`.trim() : submittedDescription
    const imageInput = form.elements.namedItem('images') as HTMLInputElement | null
    const selectedFiles = Array.from(imageInput?.files || []).slice(0, 6)
    const keptImageCount = sourceData.getAll('keptImages').filter(Boolean).length

    if (price === null || price < 0) {
      setError('Enter a valid price with up to two decimal places.')
      return
    }

    if (listingType === 'wholesale') {
      if (!bulkWeightValue.trim()) {
        setError('Enter the bale weight.')
        return
      }

      if (!attributeValues.baleGrade) {
        setError('Choose a bale grade.')
        return
      }
    }

    if (needsFlawProof) {
      if (!flawNote) {
        setError('For fair or poor condition items, describe the flaw so escrow review is clear.')
        return
      }

      if (!selectedFiles.length && !keptImageCount) {
        setError('For fair or poor condition items, upload at least one image that shows the flaw.')
        return
      }
    }

    if (completeDescription.length > LISTING_DESCRIPTION_MAX) {
      setError(`Keep the complete listing description within ${LISTING_DESCRIPTION_MAX} characters.`)
      setStep(needsFlawProof ? 1 : 0)
      return
    }

    appendText(uploadData, 'currency', 'GHS')
    appendText(uploadData, 'price', price)
    appendText(uploadData, 'status', requestedStatus)
    appendText(uploadData, 'title', readFormText(sourceData, 'title'))
    appendText(uploadData, 'type', listingType)
    appendText(uploadData, 'visibility', eventId && !editId ? 'event' : undefined)
    sourceData.getAll('keptImages').forEach((image) => appendText(uploadData, 'keptImages', String(image)))
    if (sourceData.has('keptImagesTouched')) appendText(uploadData, 'keptImagesTouched', '1')

    appendText(uploadData, 'description', completeDescription)
    uploadData.append('hashtags', readFormText(sourceData, 'hashtags'))
    ;['category', 'subcategory', 'condition'].forEach((field) => {
      appendText(uploadData, field, readFormText(sourceData, field))
    })
    if (listingType !== 'wholesale') appendText(uploadData, 'colors', JSON.stringify(colorValues))
    if (showsField('brand')) appendText(uploadData, 'brand', readFormText(sourceData, 'brand'))
    if (showsField('size')) appendText(uploadData, 'size', readFormText(sourceData, 'size'))
    if (showsField('gender')) appendText(uploadData, 'gender', readFormText(sourceData, 'gender'))
    appendText(uploadData, 'attributes', JSON.stringify(pruneListingAttributes(categoryValue, attributeValues, subcategoryValue, listingType)))

    // Every listing - retail or wholesale - is sold as a single unit; a bale
    // is one bundle, not a bulk SKU with its own stock count.
    appendText(uploadData, 'quantity', 1)
    if (listingType === 'wholesale') {
      appendText(uploadData, 'bulkWeight', readFormText(sourceData, 'bulkWeight'))
    }

    // Sent as an explicit "true"/"false" string: the API rejects anything else
    // rather than guessing, so an unset radio can never post as "allowed".
    appendText(uploadData, 'bargainingAllowed', bargainingValue === 'yes' ? 'true' : 'false')
    if (bargainingValue === 'yes' && minAcceptableNumber) {
      if (minAcceptableNumber > price) {
        setError('Your lowest acceptable price cannot be above the listed price.')
        return
      }
      appendText(uploadData, 'minAcceptablePrice', minAcceptableNumber)
    } else {
      // Clears any floor left over from a previous edit.
      appendText(uploadData, 'minAcceptablePrice', 0)
    }

    selectedFiles.forEach((file) => uploadData.append('images', file))

    setSubmitting(true)
    setSubmittingAction(requestedStatus)
    setError('')

    try {
      const data = editId
        ? await apiPut<{ listing: Listing }>(`/listings/${editId}`, uploadData)
        : await apiPost<{ listing: Listing }>('/listings', uploadData)

      if (!editId && eventId && requestedStatus === 'active') {
        await apiPost(`/community/events/${eventId}/listings`, { listingId: data.listing._id })
        draft.clearDraft()
        void clearDraftImages(draft.storageKey)
        navigateWithFlash(`/community/events/${eventId}/manage`, { message: 'The listing is live and attached to this pop-up.', title: 'Listing published', tone: 'success' })
        return
      }

      draft.clearDraft()
      void clearDraftImages(draft.storageKey)
      navigateWithFlash(
        requestedStatus === 'draft' ? '/manage-shop/drafts' : `/listing/${data.listing._id}`,
        { message: requestedStatus === 'draft' ? 'Your listing draft was saved.' : `Your listing was ${editId ? 'updated' : 'published'}.`, title: requestedStatus === 'draft' ? 'Draft saved' : 'Listing ready', tone: 'success' },
      )
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to save listing'))
    } finally {
      setSubmitting(false)
      setSubmittingAction('')
    }
  }

  if (!user?.isKycVerified) {
    return (
      <AppShell>
        <NavigationBackButton className="mb-5" fallback={returnFallback} />
        <StatePanel
          action={<ButtonLink to="/kyc">Complete KYC</ButtonLink>}
          body="KYC approval is required before you can add listings."
          layout="page"
          title="KYC required"
          tone="permission"
        />
      </AppShell>
    )
  }

  if (!user.hasShop) {
    return (
      <AppShell>
        <NavigationBackButton className="mb-5" fallback={returnFallback} />
        <StatePanel
          action={<ButtonLink to="/open-shop">Open your DigiShop</ButtonLink>}
          body="Create a DigiShop before publishing marketplace listings."
          layout="page"
          title="DigiShop required"
          tone="permission"
        />
      </AppShell>
    )
  }

  if (editId && editResource.initialLoading) {
    return (
      <AppShell searchPlaceholder="Search marketplace...">
        <NavigationBackButton className="mb-5" fallback={returnFallback} />
        <FormPageSkeleton label="Loading listing editor" media />
      </AppShell>
    )
  }

  if (editId && editResource.error && !editResource.data) {
    return (
      <AppShell searchPlaceholder="Search marketplace...">
        <NavigationBackButton className="mb-5" fallback={returnFallback} />
        <StatePanel action={<button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" onClick={() => void editResource.refetch()} type="button">Retry</button>} body={editResource.error} layout="page" title="Listing unavailable" tone="unavailable" />
      </AppShell>
    )
  }

  return (
    <AppShell searchPlaceholder="Search marketplace...">
      <FormPage
        aside={(
          <div className="rounded-2xl border border-foose-border bg-foose-surface p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Listing preview</p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-foose-text">{titleValue || 'Your listing title'}</h2>
            <p className="mt-2 text-xl font-black text-accent">{priceValue ? `GHS ${priceValue}` : 'Add a price'}</p>
            <p className="mt-3 line-clamp-4 text-sm leading-6 text-foose-muted">{descriptionValue}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-foose-muted"><span className="rounded-full bg-accent-light px-3 py-1.5">{listingType}</span>{categoryValue && <span className="rounded-full bg-foose-surface-low px-3 py-1.5">{categoryValue}</span>}{subcategoryValue && <span className="rounded-full bg-foose-surface-low px-3 py-1.5">{subcategoryValue}</span>}</div>
          </div>
        )}
        eyebrow={(
          <NavigationBackButton fallback={returnFallback} />
        )}
        title={editId ? 'Edit listing' : 'Add listing'}
        width="wide"
      >
        {!editId && (
          <StepIndicator
            current={step}
            label="Listing creation progress"
            onStepChange={(index) => { if (index < step) setStep(index) }}
            steps={['Details', 'Pricing', 'Review']}
          />
        )}

        <form className="space-y-5" encType="multipart/form-data" noValidate onSubmit={(event) => void createListing(event)}>
          <UnsavedChangesGuard when={dirty && !submitting} />
          {draft.hasRecoverableDraft && (
            <InlineNotice action={<div className="flex gap-2"><button className="min-h-11 rounded-lg px-3 font-black text-accent hover:bg-accent-light" onClick={handleResumeDraft} type="button">Resume</button><button className="min-h-11 rounded-lg px-3 font-black text-foose-muted hover:bg-foose-surface-low" onClick={handleDiscardDraft} type="button">Discard</button></div>} title="Resume listing draft?">{null}</InlineNotice>
          )}
          <ErrorSummary errors={validationAttempt ? validationErrors : []} focus={validationAttempt > 0} />

          <FormSection className={!editId && step !== 0 ? 'hidden' : ''} columns={2} title="Photos & details">
            <div className="form-field-wide">
              <ImagePreviewInput accept={ACCEPT_IMAGES} aspect="square" existingImages={listing?.images || []} hint="Up to 6 photos, in upload order. Save a draft to keep them." keptName="keptImages" keptTouchedName="keptImagesTouched" label="Listing images" maxFiles={6} multiple name="images" onFilesChange={handleSelectedFilesChange} presentation="strip" />
            </div>
            <TextField error={titleInvalid ? 'Enter at least 2 characters.' : undefined} id="listing-title" label="Title" name="title" onBlur={() => setTouched((current) => ({ ...current, title: true }))} onChange={(event) => setTitleValue(event.target.value)} placeholder="Vintage bomber jacket" required value={titleValue} wrapperClassName="form-field-wide" />
            <TextAreaField id="listing-description" label="Description" maxLength={LISTING_DESCRIPTION_MAX} name="description" onChange={(event) => setDescriptionValue(event.target.value)} optional placeholder="Condition, fit, measurements or pickup details" rows={3} value={descriptionValue} wrapperClassName="form-field-wide" />
            <div className="form-field-wide"><HashtagInput initialTags={hashtags} label="Vibe hashtags" name="hashtags" onChange={setHashtags} /></div>
            <FormField hint={listingType === 'wholesale' ? 'Price and grade apply to the whole bale.' : undefined} htmlFor="listing-type" label="Listing type" required>
              <SelectControl className={listingSelectControl} id="listing-type" name="type" onChange={(event) => changeListingType(event.target.value as 'retail' | 'wholesale')} required value={listingType}><option value="retail">Retail</option><option value="wholesale">Wholesale</option></SelectControl>
            </FormField>
          </FormSection>

          <FormSection className={!editId && step !== 1 ? 'hidden' : ''} columns={2} title="Price & attributes">
            <TextField error={priceInvalid ? 'Enter a valid amount, like 240.00.' : undefined} id="listing-price" inputMode="decimal" label="Price (GHS)" name="price" onBlur={() => setTouched((current) => ({ ...current, price: true }))} onChange={(event) => setPriceValue(event.target.value)} placeholder="240.00" prefix="GHS" required value={priceValue} />
            <FormField error={categoryInvalid ? 'Choose a category.' : undefined} htmlFor="listing-category" label="Category" required>
              <SelectControl className={listingSelectControl} id="listing-category" name="category" onChange={(event) => changeCategorySelection(event.target.value, '')} required value={categoryValue}>
                <option value="">Select category</option>
                {LISTING_CATEGORIES.map((entry) => <option key={entry.label} value={entry.label}>{entry.label}</option>)}
              </SelectControl>
            </FormField>
            {availableSubcategories.length > 0 && (
              <FormField htmlFor="listing-subcategory" label="Subcategory" optional>
                <SelectControl className={listingSelectControl} id="listing-subcategory" name="subcategory" onChange={(event) => changeCategorySelection(categoryValue, event.target.value)} value={subcategoryValue}>
                  <option value="">All {categoryValue}</option>
                  {availableSubcategories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                </SelectControl>
              </FormField>
            )}
            {showsField('size') && categoryValue === 'Footwear' && (
              <FormField error={sizeInvalid ? 'Select a size.' : undefined} htmlFor="listing-size" label={sizeLabelForCategory(categoryValue, subcategoryValue)} required>
                <SelectControl className={listingSelectControl} id="listing-size" name="size" onChange={(event) => setSizeValue(event.target.value)} required value={sizeValue}>
                  <option value="">Select EU size</option>
                  {footwearSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
                </SelectControl>
              </FormField>
            )}
            {showsField('size') && categoryValue !== 'Footwear' && <TextField error={sizeInvalid ? 'Enter a size.' : undefined} id="listing-size" label={sizeLabelForCategory(categoryValue, subcategoryValue)} name="size" onChange={(event) => setSizeValue(event.target.value)} placeholder={sizePlaceholder} required value={sizeValue} />}
            {showsField('gender') && <FormField error={genderInvalid ? 'Choose a gender.' : undefined} htmlFor="listing-gender" label="Gender" required><SelectControl className={listingSelectControl} id="listing-gender" name="gender" onChange={(event) => setGenderValue(event.target.value)} required value={genderValue}><option value="">Select gender</option><option value="men">Men</option><option value="women">Women</option><option value="unisex">Unisex</option><option value="kids">Kids</option></SelectControl></FormField>}
            {listingType !== 'wholesale' && <FormField error={conditionInvalid ? 'Choose a condition.' : undefined} htmlFor="listing-condition" label="Condition" required><SelectControl className={listingSelectControl} id="listing-condition" name="condition" onChange={(event) => setSelectedCondition(event.target.value)} required value={conditionValue}><option value="">Select condition</option>{LISTING_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition[0].toUpperCase() + condition.slice(1)}</option>)}</SelectControl></FormField>}
            {showsField('brand') && (
              <FormField htmlFor="listing-brand" label="Brand" optional>
                <SelectControl className={listingSelectControl} id="listing-brand" name="brand" onChange={(event) => setBrandValue(event.target.value)} value={brandValue}>
                  <option value="">Select brand</option>
                  <option value="Unbranded">Unbranded</option>
                  {brandedOptions.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                </SelectControl>
              </FormField>
            )}
            {showsField('material') && <FormField htmlFor="listing-material" label="Material" optional><SelectControl className={listingSelectControl} id="listing-material" onChange={(event) => changeAttribute('material', event.target.value)} value={attributeValues.material || ''}><option value="">Select material</option>{taxonomyOptions(LISTING_MATERIALS)}</SelectControl></FormField>}
            {showsField('fit') && <FormField htmlFor="listing-fit" label="Fit" optional><SelectControl className={listingSelectControl} id="listing-fit" onChange={(event) => changeAttribute('fit', event.target.value)} value={attributeValues.fit || ''}><option value="">Select fit</option>{taxonomyOptions(LISTING_FITS)}</SelectControl></FormField>}
            {showsField('pattern') && <FormField htmlFor="listing-pattern" label="Pattern" optional><SelectControl className={listingSelectControl} id="listing-pattern" onChange={(event) => changeAttribute('pattern', event.target.value)} value={attributeValues.pattern || ''}><option value="">Select pattern</option>{taxonomyOptions(LISTING_PATTERNS)}</SelectControl></FormField>}
            {showsField('baleGrade') && <FormField error={baleGradeInvalid ? 'Choose a bale grade.' : undefined} htmlFor="listing-bale-grade" label="Bale grade" required><SelectControl className={listingSelectControl} id="listing-bale-grade" onChange={(event) => changeAttribute('baleGrade', event.target.value)} required value={attributeValues.baleGrade || ''}><option value="">Select grade</option>{taxonomyOptions(LISTING_BALE_GRADES)}</SelectControl></FormField>}
            {listingType !== 'wholesale' && (
              <FormField hint="Up to 5 colors, or Multi on its own." htmlFor="listing-color" label="Colors" labelId="listing-color-label">
                <ListingColorPicker onChange={setColorValues} value={colorValues} />
              </FormField>
            )}
            {needsFlawProof && <TextAreaField className="border-foose-warning/30 bg-foose-warning-bg" hint="Show the flaw in a photo. This note is added to your description." id="listing-flaw" label="Flaw details" name="flawNote" onChange={(event) => setFlawNoteValue(event.target.value)} placeholder="Small stain on the left sleeve, shown in photo 2." required rows={3} value={flawNoteValue} wrapperClassName="form-field-wide rounded-xl bg-foose-warning-bg p-4" />}
            {listingType === 'wholesale' && <TextField error={bulkWeightInvalid ? 'Enter the bale weight.' : undefined} id="listing-weight" label="Weight (Kg)" name="bulkWeight" onChange={(event) => setBulkWeightValue(event.target.value)} placeholder="25kg" required value={bulkWeightValue} />}
            <ChoiceCardGroup<'yes' | 'no'>
              className="form-field-wide"
              error={validationAttempt > 0 && bargainingMissing ? 'Choose whether buyers can send you offers.' : undefined}
              hint="Negotiate in your inbox. Agreed prices apply only to that buyer."
              id="listing-bargaining"
              label="Allow bargaining"
              name="bargainingAllowedChoice"
              onChange={setBargainingValue}
              options={[
                { description: 'Buyers can send you offers on this item.', label: 'Yes, I will bargain', value: 'yes' },
                { description: 'The listed price is final.', label: 'No, fixed price', value: 'no' },
              ]}
              required
              value={bargainingValue === '' ? undefined : bargainingValue}
            />
            {bargainingValue === 'yes' && (
              <TextField
                error={minAcceptableInvalid ? 'Enter an amount above zero and no higher than your listed price.' : undefined}
                hint="Private. Lower offers are flagged, but still reach you."
                id="listing-min-price"
                inputMode="decimal"
                label="Lowest price you would accept (GHS)"
                onChange={(event) => setMinAcceptableValue(event.target.value)}
                optional
                placeholder="180.00"
                prefix="GHS"
                value={minAcceptableValue}
              />
            )}
          </FormSection>

          {!editId && <FormSection className={step !== 2 ? 'hidden' : ''} title="Review & publish"><div className="rounded-2xl bg-accent-light/50 p-5"><h3 className="font-display text-2xl font-semibold text-foose-text">{titleValue || 'Untitled listing'}</h3><p className="mt-2 text-xl font-black text-accent">{priceValue ? `GHS ${priceValue}` : 'Price missing'}</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-bold text-foose-faint">Format</dt><dd className="mt-1 font-semibold capitalize text-foose-text">{listingType}</dd></div><div><dt className="font-bold text-foose-faint">Category</dt><dd className="mt-1 flex items-center gap-1 font-semibold text-foose-text">{categoryValue || 'Not specified'}{subcategoryValue && <><FaAngleRight aria-hidden className="shrink-0 text-foose-faint" size={12} />{subcategoryValue}</>}</dd></div>{Object.entries(pruneListingAttributes(categoryValue, attributeValues, subcategoryValue, listingType)).map(([name, value]) => <div key={name}><dt className="font-bold text-foose-faint">{optionLabel(name)}</dt><dd className="mt-1 font-semibold text-foose-text">{optionLabel(String(value))}</dd></div>)}<div className="sm:col-span-2"><dt className="font-bold text-foose-faint">Photos</dt><dd className="mt-1">{selectedPreviews.length ? <div className="flex flex-wrap gap-2">{selectedPreviews.map((item, index) => <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-foose-border bg-foose-surface-mid sm:size-20 [&_img]:h-full [&_img]:w-full [&_img]:object-cover" key={item.url}><LightboxImage alt={`Listing photo ${index + 1}`} index={index} items={selectedPreviews.map((preview, previewIndex) => ({ alt: `Listing photo ${previewIndex + 1}`, src: preview.url }))} src={item.url} /></div>)}</div> : <span className="font-semibold text-foose-text">No photos</span>}</dd></div><div className="sm:col-span-2"><dt className="font-bold text-foose-faint">Hashtags</dt><dd className="mt-1">{hashtags.length ? <div className="flex flex-wrap gap-2">{hashtags.map((tag) => <span className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-bold text-accent" key={tag}>#{tag}</span>)}</div> : <span className="font-semibold text-foose-text">None</span>}</dd></div></dl></div></FormSection>}

          {error && <InlineNotice title="Listing was not saved" tone="error">{error}</InlineNotice>}

          <FormActions sticky>
            {!editId && step > 0 ? <button className="inline-flex min-h-12 items-center justify-center rounded-xl border border-foose-border bg-foose-surface px-5 text-sm font-bold text-foose-text hover:border-accent hover:text-accent" onClick={() => setStep((current) => Math.max(0, current - 1))} type="button">Back</button> : <ButtonLink to={eventId ? `/community/events/${eventId}/manage` : shopReturnPath} variant="secondary">Cancel</ButtonLink>}
            {!editId && step < 2 ? <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-black text-white shadow-md shadow-accent/15 hover:bg-accent-hover" onClick={continueListingStep} type="button">Continue <Icon name="arrow" /></button> : <>
              <button className="inline-flex min-h-12 items-center justify-center rounded-xl border border-foose-border bg-foose-surface px-5 text-sm font-black text-foose-text hover:border-accent hover:text-accent disabled:opacity-50" data-status="draft" disabled={submitting} type="submit">{submitting && submittingAction === 'draft' ? 'Saving draft…' : 'Save as draft'}</button>
              <SubmitButton loading={submitting && submittingAction === 'active'} loadingLabel="Saving listing…"><span className="flex flex-row items-center gap-2">{editId ? 'Save item' : 'Post'} <BsFillSendPlusFill /></span></SubmitButton>
            </>}
          </FormActions>
        </form>
      </FormPage>
    </AppShell>
  )
}
