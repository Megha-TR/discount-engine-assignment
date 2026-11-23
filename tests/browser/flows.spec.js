import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
const rule = {
  ruleId: 'PREVIEW',
  scope: 'brand',
  appliesTo: 'Natura Casa',
  type: 'percentage',
  value: 20,
  stackable: true,
}
test('sample checkout, confirmed rule, discard, errors, responsive layout', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Try sample cart' }).click()
  await expect(page.getByText('₹5,339', { exact: true })).toBeVisible()
  await expect(page.getByText('No offers available')).toBeVisible()
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true })
  await page.route('**/api/parse-rule', (route) =>
    route.fulfill({ json: { rule } }),
  )
  await page
    .getByLabel('Offer description')
    .fill('20% off for Natura Casa brand, stackable with other offers')
  await page.getByRole('button', { name: 'Preview rule' }).click()
  await expect(
    page.getByRole('heading', { name: 'Review your new rule' }),
  ).toBeVisible()
  await expect(page.getByText('₹5,339', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(page.getByText('₹5,339', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Preview rule' }).click()
  await page.getByRole('button', { name: 'Confirm & add rule' }).click()
  await expect(page.getByText('5 active')).toBeVisible()
  await expect(page.getByText('₹5,026', { exact: true })).toBeVisible()
  await page.unroute('**/api/parse-rule')
  await page.route('**/api/parse-rule', (route) =>
    route.fulfill({
      status: 422,
      json: { error: 'Specify a discount amount and a minimum cart value.' },
    }),
  )
  await page
    .getByLabel('Offer description')
    .fill('Give a discount for big orders')
  await page.getByRole('button', { name: 'Preview rule' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Specify a discount amount',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
})
test('CSV uploads and failed imports preserve the current cart', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByLabel('Upload rules CSV')
    .setInputFiles(resolve('sample-data/rules.csv'))
  await page
    .getByLabel('Upload cart CSV or PDF')
    .setInputFiles(resolve('sample-data/cart.csv'))
  await expect(page.getByText('₹5,339', { exact: true })).toBeVisible()
  await page.getByLabel('Upload cart CSV or PDF').setInputFiles({
    name: 'bad.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'item_id,product,brand,platform,base_price\nX,Vase,X,Y,nope',
    ),
  })
  await expect(page.getByText('₹5,339', { exact: true })).toBeVisible()
  await expect(page.getByText(/Base price must be/)).toBeVisible()
})
test('actual PDF upload replaces cart and reruns with existing rules', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try sample cart' }).click()
  await page
    .getByLabel('Upload cart CSV or PDF')
    .setInputFiles(resolve('sample-data/cart.pdf'))
  await expect(page.getByRole('status')).toContainText('cart.pdf loaded')
  await expect(page.getByText('₹5,339', { exact: true })).toBeVisible()
  await expect(page.getByText('6 items', { exact: true })).toBeVisible()
})
