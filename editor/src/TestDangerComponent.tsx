export const TestDangerComponent = () => {
  const htmlContent = '<p>This should be blocked</p>'
  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
}
