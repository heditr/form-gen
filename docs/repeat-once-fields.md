# Repeat-once progress bar

An inline repeatable block can show one readonly progress bar. The bar is drawn after the rows. When the block has `repeatableChild`, each child list draws the same bar after its own rows.

The bar is not a form value. It is not validated and not submitted. It sums one grouped number field on the list it belongs to. The root bar does not include child-row values.

## Descriptor

The block has at most one field with `repeatOnce: true`. That field has type `progress`.

```typescript
{
  id: 'sectorShare',
  type: 'progress',
  label: 'Total share',
  repeatOnce: true,
  progress: { sumField: 'percentage', max: 100 },
  validation: [],
}
```

`sumField` is the base id of a grouped `number` field. `max` is the full scale of the bar. A sum above `max` still shows the raw total. The bar width stops at 100 percent.

Declaration order does not move the bar. It always renders after the row cards and before Add.

## Child lists

A holding row's subsector list shows a second bar. That bar sums `percentage` on the subsector rows only.

```json
{
  "businessSectors": [
    {
      "sector": "holding",
      "percentage": 70,
      "subsectors": [{ "sector": "software", "percentage": 40 }]
    },
    { "sector": "retail", "percentage": 30 }
  ]
}
```

The root bar reads 100. The holding row's child bar reads 40. `sectorShare` is not a key on either row.

## Descriptor errors

`assertRepeatOnce` runs after `assertRepeatableChildren`. A failure is a `RepeatOnceDescriptorError`.

| Code | Raised when |
| ---- | ----------- |
| `REPEAT_ONCE_PARENT_KIND` | The block is not an inline repeatable block. |
| `REPEAT_ONCE_LIMIT` | The block has more than one `repeatOnce` field. |
| `REPEAT_ONCE_GROUP` | The field also has `repeatableGroupId`, or the block does not have exactly one group id. |
| `REPEAT_ONCE_ID` | The id is empty or its first segment equals the group id. |
| `REPEAT_ONCE_PROPERTY_CLASH` | The id equals `repeatableChild.property`. |
| `REPEAT_ONCE_INDEX` | A string `defaultValue` contains `@index` or `@outerIndex`. |
| `REPEAT_ONCE_TYPE` | The field is not `progress`. |
| `REPEAT_ONCE_SUM` | `sumField` is not a grouped number field, or `max` is not a positive number. |
| `REPEAT_ONCE_DUPLICATE` | The same field id is declared more than once. |

## Demo

`/api/form/global-descriptor-demo` puts `sectorShare` on `business-sectors-block`.
