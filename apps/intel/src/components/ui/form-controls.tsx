'use client';

import { Autocomplete } from '@base-ui/react/autocomplete';
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Combobox } from '@base-ui/react/combobox';
import { Select } from '@base-ui/react/select';
import { Check, ChevronDown, ChevronsUpDown, LoaderCircle, Search } from 'lucide-react';
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useId,
} from 'react';
import './form-controls.css';

// Response desk controls: coss-inspired density and state treatment, Base UI behavior,
// Wisesama's Satoshi/purple tokens. Controlled values and native validation stay with callers.
type FieldAttributes = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
};
export function FormField({
  id,
  label,
  description,
  error,
  required,
  children,
  className = '',
}: {
  id?: string;
  label: string;
  description?: ReactNode;
  error?: string;
  required?: boolean;
  children: (attributes: FieldAttributes) => ReactNode;
  className?: string;
}) {
  const generated = useId();
  const controlId = id ?? `${generated}-control`;
  const describedBy =
    [description ? `${controlId}-hint` : '', error ? `${controlId}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={`ws-field ${className}`}>
      <label className="ws-field-label" htmlFor={controlId}>
        {label}
        {required ? (
          <span className="ws-required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        ...(error ? { 'aria-invalid': true as const } : {}),
      })}
      {description ? (
        <p className="ws-field-hint" id={`${controlId}-hint`}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p className="ws-field-error" id={`${controlId}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode };
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { icon, className = '', disabled, ...props },
  ref,
) {
  return (
    <div
      className="ws-input-shell"
      data-disabled={disabled || undefined}
      data-invalid={props['aria-invalid'] || undefined}
    >
      {icon ? (
        <span className="ws-input-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <input
        {...props}
        ref={ref}
        disabled={disabled}
        data-ws-input
        className={`ws-text-input ${className}`}
      />
    </div>
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className = '', ...props }, ref) {
  return <textarea {...props} ref={ref} className={`ws-textarea ${className}`} />;
});

export type ControlOption = { value: string; label: string; description?: string };
type PickerProps = FieldAttributes & {
  options: ControlOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  name?: string;
  required?: boolean;
  icon?: ReactNode;
};

function TriggerIcon({ loading }: { loading?: boolean }) {
  return loading ? (
    <LoaderCircle className="ws-spin" aria-hidden="true" />
  ) : (
    <ChevronDown aria-hidden="true" />
  );
}

/** A short, fixed list. Values remain strings, independent of their display labels. */
export function Choice({
  options,
  value,
  onValueChange,
  disabled,
  loading,
  placeholder = 'Choose an option',
  icon,
  ...field
}: PickerProps) {
  return (
    <Select.Root
      items={options}
      value={value || null}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      disabled={disabled}
      name={field.name}
      required={field.required}
    >
      <Select.Trigger
        id={field.id}
        aria-describedby={field['aria-describedby']}
        aria-invalid={field['aria-invalid']}
        aria-busy={loading || undefined}
        className="ws-picker"
      >
        {icon ? (
          <span className="ws-control-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <Select.Value className="ws-picker-value" placeholder={placeholder} />
        <Select.Icon className="ws-picker-icon">
          <TriggerIcon loading={loading} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className="ws-positioner"
          sideOffset={6}
          alignItemWithTrigger={false}
          collisionPadding={12}
        >
          <Select.Popup className="ws-popup">
            <Select.List className="ws-option-list">
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} className="ws-option">
                  <Select.ItemIndicator className="ws-option-check">
                    <Check aria-hidden="true" />
                  </Select.ItemIndicator>
                  <div className="ws-option-copy">
                    <Select.ItemText>{option.label}</Select.ItemText>
                    {option.description ? <small>{option.description}</small> : null}
                  </div>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

/** A searchable fixed list for organization/account identity; typing cannot create a value. */
export function SearchChoice({
  options,
  value,
  onValueChange,
  disabled,
  loading,
  placeholder = 'Choose an option',
  searchLabel,
  emptyMessage = 'No matching options.',
  icon,
  ...field
}: PickerProps & { searchLabel: string; emptyMessage?: string }) {
  const selected = options.find((option) => option.value === value) ?? null;
  return (
    <Combobox.Root
      items={options}
      value={selected}
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.value}
      onValueChange={(next) => {
        if (next) onValueChange(next.value);
      }}
      disabled={disabled}
      name={field.name}
      required={field.required}
    >
      <Combobox.Trigger
        id={field.id}
        aria-describedby={field['aria-describedby']}
        aria-invalid={field['aria-invalid']}
        aria-busy={loading || undefined}
        className="ws-picker"
        title={selected?.label}
      >
        {icon ? (
          <span className="ws-control-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className="ws-picker-value" data-placeholder={!selected || undefined}>
          {selected?.label || placeholder}
        </span>
        <span className="ws-picker-icon">
          {loading ? (
            <LoaderCircle className="ws-spin" aria-hidden="true" />
          ) : (
            <ChevronsUpDown aria-hidden="true" />
          )}
        </span>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner className="ws-positioner" sideOffset={6} collisionPadding={12}>
          <Combobox.Popup className="ws-popup ws-search-popup">
            <div className="ws-popup-search">
              <Search aria-hidden="true" />
              <Combobox.Input
                aria-label={searchLabel}
                placeholder={searchLabel}
                className="ws-search-input"
                autoComplete="off"
              />
            </div>
            <Combobox.Empty className="ws-empty">{emptyMessage}</Combobox.Empty>
            <Combobox.List className="ws-option-list">
              {(option: ControlOption) => (
                <Combobox.Item key={option.value} value={option} className="ws-option">
                  <Combobox.ItemIndicator className="ws-option-check">
                    <Check aria-hidden="true" />
                  </Combobox.ItemIndicator>
                  <div className="ws-option-copy">
                    <span>{option.label}</span>
                    {option.description ? <small>{option.description}</small> : null}
                  </div>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

/** Suggestions aid entry without restricting valid branch names to the bounded provider list. */
export function SuggestedInput({
  value,
  onValueChange,
  suggestions,
  icon,
  disabled,
  ...props
}: Omit<TextInputProps, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  suggestions: string[];
}) {
  return (
    <Autocomplete.Root
      items={suggestions}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <div className="ws-input-shell" data-disabled={disabled || undefined}>
        {icon ? (
          <span className="ws-input-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <Autocomplete.Input {...props} className="ws-text-input" data-ws-input autoComplete="off" />
        <Autocomplete.Trigger className="ws-input-action" aria-label="Show branch suggestions">
          <ChevronDown aria-hidden="true" />
        </Autocomplete.Trigger>
      </div>
      <Autocomplete.Portal>
        <Autocomplete.Positioner className="ws-positioner" sideOffset={6} collisionPadding={12}>
          <Autocomplete.Popup className="ws-popup">
            <Autocomplete.Empty className="ws-empty">
              No suggested branch matches. You can use the exact name entered.
            </Autocomplete.Empty>
            <Autocomplete.List className="ws-option-list">
              {(item: string) => (
                <Autocomplete.Item key={item} value={item} className="ws-option ws-suggestion">
                  {item}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

export function CheckControl({
  checked,
  onCheckedChange,
  ...props
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  'aria-describedby'?: string;
}) {
  return (
    <CheckboxPrimitive.Root
      {...props}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="ws-check"
    >
      <CheckboxPrimitive.Indicator className="ws-check-mark">
        <Check aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
