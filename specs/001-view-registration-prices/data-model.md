# Data Model

## Entities

### RegistrationPrice
- **Description**: Price amount for a registration category.
- **Fields**:
  - `category_name` (string, required)
  - `amount` (number, nullable)
  - `active` (boolean, required)
- **Validation Rules**:
  - `category_name` must be non-empty.
  - `amount` must be a non-negative number when present.
- **Notes**:
  - If `amount` is missing, UI displays “Not available”.
  - If `active` is false, category is hidden from attendee view.

### PricingCategory
- **Description**: Label/grouping for registration prices.
- **Fields**:
  - `name` (string, required)
  - `active` (boolean, required)
- **Relationships**:
  - One `PricingCategory` can have zero or one `RegistrationPrice` entry.

### AccessPolicy
- **Description**: Access rule for pricing view.
- **Fields**:
  - `public_viewable` (boolean, required; always true for this feature)

## State Transitions

- `PricingCategory.active`: `true` → `false` (category becomes hidden) and `false` → `true` (category becomes visible).
