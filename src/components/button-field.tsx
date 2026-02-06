/**
 * ButtonField Component
 * 
 * Renders a button field that can trigger popin blocks.
 * Supports single button and menu/dropdown button variants.
 */

import { usePopinManager } from './popin-manager';
import { Button } from '@/components/ui/button';
import type { FieldDescriptor } from '@/types/form-descriptor';
import { Label } from '@/components/ui/label';

export interface ButtonFieldProps {
  field: FieldDescriptor;
  isDisabled: boolean;
}

/**
 * ButtonField Component
 * 
 * Renders a button that opens a popin block when clicked.
 */
export default function ButtonField({
  field,
  isDisabled,
}: ButtonFieldProps) {
  const { openPopin } = usePopinManager();

  if (!field.button) {
    return null;
  }

  const handleClick = () => {
    if (field.button?.popinBlockId) {
      openPopin(field.button.popinBlockId);
    }
  };

  // Single button variant
  if (field.button.variant === 'single' || field.button.variant === 'link') {
    return (
      <div data-testid={`field-${field.id}`} className="field-wrapper">
        {field.label && <Label>{field.label}</Label>}
        {field.description && (
          <p className="text-sm text-muted-foreground mb-2">{field.description}</p>
        )}
        <Button
          variant={field.button.variant === 'link' ? 'link' : 'default'}
          onClick={handleClick}
          disabled={isDisabled}
        >
          {field.label}
        </Button>
      </div>
    );
  }

  // Menu variant - for now, just render first item as a button
  // TODO: Implement proper dropdown menu with Shadcn DropdownMenu component
  if (field.button.variant === 'menu' && field.button.items && field.button.items.length > 0) {
    const firstItem = field.button.items[0];
    return (
      <div data-testid={`field-${field.id}`} className="field-wrapper">
        {field.label && <Label>{field.label}</Label>}
        {field.description && (
          <p className="text-sm text-muted-foreground mb-2">{field.description}</p>
        )}
        <Button
          onClick={() => openPopin(firstItem.popinBlockId)}
          disabled={isDisabled}
        >
          {firstItem.label}
        </Button>
      </div>
    );
  }

  return null;
}
