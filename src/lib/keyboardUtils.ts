/**
 * Keyboard utilities for form navigation and input handling
 * Pure functions that can be reused across components
 */

import { toast } from 'sonner';

export interface KeyboardShortcutConfig {
  onFocusFirst?: () => void;
  onFocusLast?: () => void;
  onFocusByIndex?: (index: number) => void;
  onFocusComment?: () => void;
  onClearField?: () => void;
  onOpenImage?: () => void;
  onToggleDropdown?: () => void;
  onSelectDropdownValue?: (number: number) => void;
  onCloseDropdowns?: () => void;
  onAutoOpenDropdown?: (element: HTMLElement) => void;
}

/**
 * Close all open dropdowns and select elements
 */
export const closeAllDropdowns = (): void => {
  // Close any open dropdowns by clicking outside or pressing Escape
  const openDropdowns = document.querySelectorAll('[data-state="open"], [aria-expanded="true"]');
  openDropdowns.forEach(dropdown => {
    // Try to close by triggering escape key
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    dropdown.dispatchEvent(escapeEvent);
  });
  
  // Also try clicking outside to close dropdowns
  const clickOutsideEvent = new MouseEvent('click', { bubbles: true });
  document.body.dispatchEvent(clickOutsideEvent);
  
  // Additional method: find and close any Radix UI dropdowns
  const radixDropdowns = document.querySelectorAll('[data-radix-popper-content-wrapper]');
  radixDropdowns.forEach(dropdown => {
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    dropdown.dispatchEvent(escapeEvent);
  });
  
  // Force close any select elements that might be open
  const selectElements = document.querySelectorAll('select');
  selectElements.forEach(select => {
    select.blur();
  });
};

/**
 * Auto-open dropdown for focused element
 */
export const autoOpenDropdown = (element: HTMLElement): void => {
  // Check if it's a dropdown/select field
  if (element.tagName === 'SELECT' || element.getAttribute('role') === 'combobox') {
    // Small delay to ensure focus is set first
    setTimeout(() => {
      // For select elements, trigger click to open dropdown
      if (element.tagName === 'SELECT') {
        (element as HTMLSelectElement).click();
      } else {
        // For combobox elements (like shadcn Select), trigger click
        element.click();
      }
    }, 200); // Increased delay to ensure previous dropdown is fully closed
  }
};

/**
 * Focus first input field
 */
export const focusFirstInput = (config?: KeyboardShortcutConfig): void => {
  const allInputs = document.querySelectorAll('input, textarea, select, [role="combobox"], [role="button"], [role="checkbox"], [role="radio"]') as NodeListOf<HTMLInputElement>;
  const inputArray = Array.from(allInputs);

  if (inputArray.length > 0) {
    const firstElement = inputArray[0];
    firstElement?.focus();
    
    // Close any open dropdowns when navigating away (after focus is set)
    setTimeout(() => {
      if (config?.onCloseDropdowns) {
        config.onCloseDropdowns();
      } else {
        closeAllDropdowns();
      }
      // Then open dropdown for current field if it's a dropdown
      if (config?.onAutoOpenDropdown) {
        config.onAutoOpenDropdown(firstElement);
      } else {
        autoOpenDropdown(firstElement);
      }
    }, 50);
    
    const fieldName = firstElement?.name || 
                     firstElement?.placeholder || 
                     firstElement?.getAttribute('aria-label') ||
                     firstElement?.getAttribute('data-label') ||
                     'First field';
    toast.success(`Focused: ${fieldName}`);
  }
};

/**
 * Focus last input field
 */
export const focusLastInput = (config?: KeyboardShortcutConfig): void => {
  const allInputs = document.querySelectorAll('input, textarea, select, [role="combobox"], [role="button"], [role="checkbox"], [role="radio"]') as NodeListOf<HTMLInputElement>;
  const inputArray = Array.from(allInputs);

  if (inputArray.length > 0) {
    const lastIndex = inputArray.length - 1;
    const lastElement = inputArray[lastIndex];
    lastElement?.focus();
    
    // Close any open dropdowns when navigating away (after focus is set)
    setTimeout(() => {
      if (config?.onCloseDropdowns) {
        config.onCloseDropdowns();
      } else {
        closeAllDropdowns();
      }
      // Then open dropdown for current field if it's a dropdown
      if (config?.onAutoOpenDropdown) {
        config.onAutoOpenDropdown(lastElement);
      } else {
        autoOpenDropdown(lastElement);
      }
    }, 50);
    
    const fieldName = lastElement?.name || 
                     lastElement?.placeholder || 
                     lastElement?.getAttribute('aria-label') ||
                     lastElement?.getAttribute('data-label') ||
                     'Last field';
    toast.success(`Focused: ${fieldName}`);
  }
};

/**
 * Focus specific input field by index (1-based)
 */
export const focusInputByIndex = (index: number, config?: KeyboardShortcutConfig): void => {
  const allInputs = document.querySelectorAll('input, textarea, select, [role="combobox"], [role="button"], [role="checkbox"], [role="radio"]') as NodeListOf<HTMLInputElement>;
  const inputArray = Array.from(allInputs);
  
  // Convert to 0-based index
  const targetIndex = index - 1;
  
  if (inputArray.length > 0 && targetIndex >= 0 && targetIndex < inputArray.length) {
    const targetElement = inputArray[targetIndex];
    
    // First, close any open dropdowns
    if (config?.onCloseDropdowns) {
      config.onCloseDropdowns();
    } else {
      closeAllDropdowns();
    }
    
    // Wait a bit longer to ensure dropdowns are fully closed before focusing
    setTimeout(() => {
      targetElement?.focus();
      
      // Then open dropdown for current field if it's a dropdown (with additional delay)
      setTimeout(() => {
        if (config?.onAutoOpenDropdown) {
          config.onAutoOpenDropdown(targetElement);
        } else {
          autoOpenDropdown(targetElement);
        }
      }, 100);
    }, 150);
    
    const fieldName = targetElement?.name || 
                     targetElement?.placeholder || 
                     targetElement?.getAttribute('aria-label') ||
                     targetElement?.getAttribute('data-label') ||
                     `Field ${index}`;
    toast.success(`Focused: ${fieldName}`);
  } else {
    toast.error(`Field ${index} not available (${inputArray.length} fields total)`);
  }
};

/**
 * Focus comment field
 */
export const focusCommentField = (): void => {
  const commentField = document.querySelector('textarea[name="notes"]') as HTMLTextAreaElement;
  if (commentField) {
    commentField.focus();
    toast.success('Focused: Comment field');
  } else {
    toast.error('Comment field not found');
  }
};

/**
 * Clear current focused field
 */
export const clearCurrentField = (): void => {
  const focusedElement = document.activeElement;
  if (focusedElement && (focusedElement.tagName === 'INPUT' || focusedElement.tagName === 'TEXTAREA')) {
    const inputElement = focusedElement as HTMLInputElement;
    
    // Clear the value
    inputElement.value = '';
    
    // Trigger React form events
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    
    // If it's a React Hook Form field, also trigger blur to ensure form state updates
    inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
    
    toast.success('Field cleared');
  } else {
    toast.error('No input field focused');
  }
};

/**
 * Toggle dropdown/select field
 */
export const toggleDropdown = (): void => {
  const focusedElement = document.activeElement;
  if (focusedElement && (focusedElement.tagName === 'SELECT' || focusedElement.getAttribute('role') === 'combobox')) {
    // Trigger click to open dropdown
    (focusedElement as HTMLElement).click();
    toast.success('Dropdown opened');
  } else {
    toast.error('No dropdown field focused');
  }
};

/**
 * Open current image in new tab
 */
export const openImageInNewTab = (currentTaskData: Record<string, unknown>, currentImageIndex: number): void => {
  if (!currentTaskData) {
    toast.error('No image available');
    return;
  }

  let imageUrl: string | null = null;
  
  if (currentTaskData.image_urls && Array.isArray(currentTaskData.image_urls) && currentTaskData.image_urls.length > 0) {
    imageUrl = currentTaskData.image_urls[currentImageIndex] as string;
  } else if (currentTaskData.image_url_0) {
    imageUrl = currentTaskData.image_url_0 as string;
  } else if (currentTaskData.image) {
    imageUrl = currentTaskData.image as string;
  } else if (currentTaskData.Image) {
    imageUrl = currentTaskData.Image as string;
  }

  if (imageUrl) {
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
    toast.success('Image opened in new tab');
  } else {
    toast.error('No image URL found');
  }
};

/**
 * Check if element is a dropdown field
 */
export const isDropdownField = (element: Element | null): boolean => {
  if (!element) return false;
  
  return (
    element.tagName === 'SELECT' ||
    element.getAttribute('role') === 'combobox' ||
    element.getAttribute('data-state') !== null ||
    element.closest('[role="combobox"]') !== null ||
    (element.tagName === 'BUTTON' && element.getAttribute('aria-expanded') !== null) ||
    element.closest('button[aria-expanded]') !== null ||
    element.closest('[data-radix-select-trigger]') !== null
  );
};

/**
 * Check if element is an input field
 */
export const isInputField = (element: Element | null): boolean => {
  if (!element) return false;
  
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
};

/**
 * Prevent Enter key from submitting when focused on dropdowns
 */
export const preventEnterOnDropdowns = (event: KeyboardEvent): boolean => {
  if (event.key === 'Enter' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
    const focusedElement = document.activeElement;
    const isDropdownFocused = isDropdownField(focusedElement);
    
    if (isDropdownFocused) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Close any open dropdowns
      const openDropdowns = document.querySelectorAll('[role="combobox"][aria-expanded="true"]');
      openDropdowns.forEach(dropdown => {
        (dropdown as HTMLElement).click();
      });
      
      return false;
    }
  }
  return true;
};
