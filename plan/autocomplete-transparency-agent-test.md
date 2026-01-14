# Agent Test: Autocomplete Transparency Issue

**Environment**: Drive real browser, discover UI by looking (no source code access)

**Test Goal**: Identify and document the issue where autocomplete field suggestions list becomes transparent when user changes country selection

**Persona behavior**:
- Patience: 8/10
- Retry: immediate
- On failure: retry

## Execution Steps

### Step 1: Navigate to Demo Page
- **Action**: Navigate to http://localhost:3000/demo
- **Intent**: Load the demo page with the form
- **Success**: Page loads, form is visible, country dropdown is present
- **Checkpoint**: true

### Step 2: Initial State Check
- **Action**: Observe the initial state of the form
- **Intent**: Understand the baseline appearance before interaction
- **Success**: Form fields are visible, country dropdown shows placeholder/default
- **Checkpoint**: true

### Step 3: Open City Autocomplete (Before Country Change)
- **Action**: Click on the City autocomplete field to open suggestions list
- **Intent**: Verify normal appearance of autocomplete suggestions
- **Success**: Suggestions list appears with proper opacity/visibility
- **Checkpoint**: true

### Step 4: Change Country Selection
- **Action**: Select a country from the Country dropdown (e.g., "United States")
- **Intent**: Trigger re-hydration that may affect autocomplete styling
- **Success**: Country is selected, form may show re-hydration status
- **Checkpoint**: true

### Step 5: Open City Autocomplete (After Country Change)
- **Action**: Click on the City autocomplete field again to open suggestions list
- **Intent**: Check if suggestions list becomes transparent after country change
- **Success**: Identify if suggestions list has transparency/visibility issues
- **Checkpoint**: true

### Step 6: Verify Transparency Issue
- **Action**: Inspect the suggestions list appearance (opacity, visibility, z-index)
- **Intent**: Document the exact visual issue
- **Success**: Identify and document the transparency problem
- **Checkpoint**: true

### Step 7: Test Multiple Country Changes
- **Action**: Change country selection multiple times (US → CA → UK) and check autocomplete each time
- **Intent**: Determine if issue is consistent or intermittent
- **Success**: Document pattern of when transparency occurs
- **Checkpoint**: true

## Expected Output Format

```markdown
# Test Report: Autocomplete Transparency Issue

**Completed**: X of Y steps

## Step: [step name]
- **Status**: ✓ Success / ✗ Failed
- **Duration**: Xs
- **Difficulty**: easy/moderate/difficult
- **Thoughts**: [What I saw, expected, any confusion]
- **Screenshot**: [path if captured]

## Findings
- [Detailed description of the transparency issue]
- [When it occurs]
- [Visual evidence]

## Blockers
- [Any steps that couldn't be completed and why]
```
