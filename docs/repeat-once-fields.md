# Repeat-once fields

An inline repeatable block can store a field once, at that field's own id, and draw it once with the group. The value is not a cell of a root row and not a cell of a `repeatableChild` row. Adding or removing a row leaves it in place.

This is separate from [repeatable-child-rows.md](repeatable-child-rows.md), which nests another list of the same group inside a root row.

## Descriptor

Set `repeatOnce: true` on a field of an inline repeatable block (`repeatable: true`, no `popin`, no `repeatablePopin`). The block still has exactly one `repeatableGroupId`. The once-field does not set `repeatableGroupId`.

```typescript
{
  id: 'addresses-block',
  title: 'Addresses',
  repeatable: true,
  fields: [
    { id: 'country', type: 'dropdown', label: 'Country', repeatOnce: true, validation: [] },
    { id: 'addresses.street', type: 'text', label: 'Street', repeatableGroupId: 'addresses', validation: [] },
    { id: 'addresses.city', type: 'text', label: 'City', repeatableGroupId: 'addresses', validation: [] },
  ],
}
```

Submitted value:

```json
{ "country": "FR", "addresses": [{ "street": "1 main", "city": "Paris" }] }
```

With `repeatableChild`, `country` stays at the form root. A child path stays `businessSectors.0.subsectors.1.sector`. It is never `businessSectors.0.country` and never inside a child row.

Placement follows `fields` order inside the group section:

- Once-fields before the first grouped field render above the rows, including when the list is empty.
- Once-fields after the last grouped field render below Add.
- A once-field between two grouped fields is a descriptor error. It would split the row template.

Ungrouped fields without `repeatOnce` keep today's behavior: they render after the group and stay out of the row schema. The flag is not applied for them.

Authors bind a default with a normal template such as `{{caseContext.country}}`. `repeatableDefaultSource` does not copy the once-field out of a source row. A string `defaultValue` cannot contain `@index` or `@outerIndex`.

`repeatableBlockRef` copies a `repeatOnce` field without a group prefix and without `repeatableGroupId`. Row fields keep today's prefix. The check runs on the resolved descriptor, so a template block may carry the flag before it is referenced.

### Descriptor errors

The global descriptor routes call `assertRepeatOnce` after `assertRepeatableChildren`. A failure is a `RepeatOnceDescriptorError` (created with `createError`, code on `error.cause.code`) and the route responds 500.

| Code | Raised when |
| ---- | ----------- |
| `REPEAT_ONCE_PARENT_KIND` | The block is not inline repeatable (`repeatable: true`, no `popin`, no `repeatablePopin`). |
| `REPEAT_ONCE_GROUP` | The field also has `repeatableGroupId`, or the block does not have exactly one group id. |
| `REPEAT_ONCE_PLACEMENT` | The field sits between two grouped fields. |
| `REPEAT_ONCE_ID` | The id is empty, equals the group id, or its first segment equals the group id. |
| `REPEAT_ONCE_PROPERTY_CLASH` | The id equals `repeatableChild.property` when that config is present. |
| `REPEAT_ONCE_INDEX` | A string `defaultValue` contains `@index` or `@outerIndex`. |
| `REPEAT_ONCE_TYPE` | The field type is `button`. |
| `REPEAT_ONCE_DUPLICATE` | The same field id appears twice. |

## Schema, defaults, and submit

The row schema and the child-row schema are built only from grouped fields. Each `repeatOnce` field is a top-level schema key, the same way a field on a plain block is. Hidden fields are omitted. The key is not on the row object or the child row object.

`extractDefaultValues` writes each once-field at `field.id` with no row index. A hidden block contributes nothing.

On submit, a hidden once-field is stripped from the values. Visible once-fields stay. Row values are left as they are. The validation fingerprint includes the once-field so a rule change refreshes validation.

## Demo

`/api/form/global-descriptor-demo` puts `activityCountry` (`repeatOnce: true`) on `business-sectors-block`, above the sector rows.
