/**
 * Custom hook for keyboard shortcuts management
 * Provides reusable keyboard shortcut functionality across components
 */

import { useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  closeAllDropdowns,
  autoOpenDropdown,
  focusFirstInput,
  focusLastInput,
  focusInputByIndex,
  focusCommentField,
  clearCurrentField,
  toggleDropdown,
  openImageInNewTab,
  isDropdownField,
  isInputField,
  preventEnterOnDropdowns,
  type KeyboardShortcutConfig
} from '@/lib/keyboardUtils';

export interface KeyboardShortcutHandlers {
  // Navigation
  onPreviousTask?: () => void;
  onNextTask?: () => void;
  onSkipTask?: () => void;
  
  // Image navigation
  onPreviousImage?: () => void;
  onNextImage?: () => void;
  
  // Form actions
  onSubmit?: () => void;
  onFocusComment?: () => void;
  
  // Dropdown handling
  onSelectDropdownValue?: (number: number) => void;
  
  // UI actions
  onToggleShortcuts?: () => void;
  onCloseShortcuts?: () => void;
}

type OutputField = {
  name: string;
  required?: boolean;
  type?: string;
  dropdownOptions?: string[];
  description?: string;
};

export interface KeyboardShortcutOptions {
  enabled?: boolean;
  handlers: KeyboardShortcutHandlers;
  config?: KeyboardShortcutConfig;
  // Additional context for specific shortcuts
  canGoToNext?: boolean;
  canGoToPrevious?: boolean;
  canAnnotate?: boolean;
  currentTaskData?: Record<string, unknown>;
  currentImageIndex?: number;
  outputConfig?: OutputField[];
  setValue?: (name: string, value: unknown) => void;
  watch?: (name: string) => unknown;
  useLegacyMode?: boolean;
}

/**
 * Custom hook for managing keyboard shortcuts
 */
export const useKeyboardShortcuts = (options: KeyboardShortcutOptions) => {
  const {
    enabled = true,
    handlers,
    config,
    canGoToNext = false,
    canGoToPrevious = false,
    canAnnotate = false,
    currentTaskData,
    currentImageIndex = 0,
    outputConfig = [],
    setValue,
    watch,
    useLegacyMode = false
  } = options;

  // Create enhanced config with handlers
  const enhancedConfig: KeyboardShortcutConfig = useMemo(() => ({
    onCloseDropdowns: closeAllDropdowns,
    onAutoOpenDropdown: autoOpenDropdown,
    onFocusFirst: () => focusFirstInput(config),
    onFocusLast: () => focusLastInput(config),
    onFocusByIndex: (index: number) => focusInputByIndex(index, config),
    onFocusComment: focusCommentField,
    onClearField: clearCurrentField,
    onOpenImage: () => currentTaskData && openImageInNewTab(currentTaskData, currentImageIndex),
    onToggleDropdown: toggleDropdown,
    onSelectDropdownValue: handlers.onSelectDropdownValue,
    ...config
  }), [config, currentTaskData, currentImageIndex, handlers?.onSelectDropdownValue]);

  // Select dropdown value by number key
  const selectDropdownValueByNumber = useCallback((number: number) => {
    const focusedElement = document.activeElement;
    
    if (!focusedElement) {
      toast.error('No field focused');
      return;
    }

    // Check if it's a dropdown/select field
    if (focusedElement.tagName === 'SELECT') {
      const selectElement = focusedElement as HTMLSelectElement;
      const options = Array.from(selectElement.options);
      const targetIndex = number - 1; // Convert to 0-based index
      
      if (targetIndex >= 0 && targetIndex < options.length) {
        selectElement.selectedIndex = targetIndex;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        toast.success(`Selected: ${options[targetIndex].text}`);
      } else {
        toast.error(`Option ${number} not available (${options.length} options)`);
      }
    } else if (focusedElement.getAttribute('role') === 'option') {
      // Handle when dropdown is open and focus is on an option
      
      // Find the parent dropdown trigger to get the field name
      const dropdownTrigger = document.querySelector('[role="combobox"][data-state="open"]') || 
                              document.querySelector('[role="combobox"]');
      
      if (dropdownTrigger) {
        const fieldName = dropdownTrigger.getAttribute('data-field-name');
        
        if (fieldName && outputConfig && setValue) {
          const fieldConfig = outputConfig.find((field: OutputField) => field.name === fieldName);
          
          if (fieldConfig && fieldConfig.type === 'dropdown' && fieldConfig.dropdownOptions) {
            const targetIndex = number - 1;
            
            if (targetIndex >= 0 && targetIndex < fieldConfig.dropdownOptions.length) {
              const selectedValue = fieldConfig.dropdownOptions[targetIndex];
              
              setValue(fieldName, selectedValue);
              
              // Close the dropdown by pressing Escape key
              setTimeout(() => {
                const escapeEvent = new KeyboardEvent('keydown', {
                  key: 'Escape',
                  code: 'Escape',
                  keyCode: 27,
                  which: 27,
                  bubbles: true
                });
                document.dispatchEvent(escapeEvent);
              }, 100);
              
              toast.success(`Selected option ${number}: ${selectedValue}`);
              return;
            } else {
              toast.error(`Option ${number} not available (${fieldConfig.dropdownOptions.length} options)`);
              return;
            }
          }
        }
      }
      
      // If we can't find the field config, try to click the option directly
      const targetIndex = number - 1;
      
      // Find all options in the current dropdown
      const allOptions = document.querySelectorAll('[role="option"]');
      
      if (targetIndex >= 0 && targetIndex < allOptions.length) {
        const selectedOption = allOptions[targetIndex] as HTMLElement;
        selectedOption.click();
        toast.success(`Selected option ${number}: ${selectedOption.textContent}`);
      } else {
        toast.error(`Option ${number} not available (${allOptions.length} options)`);
      }
    } else if (focusedElement.getAttribute('role') === 'combobox' || focusedElement.getAttribute('data-state')) {
      
      // Try to find the field name from the focused element or its parents
      let fieldName = focusedElement.getAttribute('name') || 
                     focusedElement.getAttribute('data-field-name');
      
      // If not found, look in parent elements
      if (!fieldName) {
        const parentWithName = focusedElement.closest('[data-field-name]');
        fieldName = parentWithName?.getAttribute('data-field-name') || null;
      }
      
      if (fieldName && outputConfig && setValue) {
        // Find the field configuration
        const fieldConfig = outputConfig.find((field: OutputField) => field.name === fieldName);
        
        if (fieldConfig && fieldConfig.type === 'dropdown' && fieldConfig.dropdownOptions) {
          const targetIndex = number - 1; // Convert to 0-based index
          
          if (targetIndex >= 0 && targetIndex < fieldConfig.dropdownOptions.length) {
            const selectedValue = fieldConfig.dropdownOptions[targetIndex];
            
            // Use React Hook Form's setValue to update the field
            setValue(fieldName, selectedValue);
            
            // Close the dropdown by pressing Escape key
            setTimeout(() => {
              const escapeEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true
              });
              document.dispatchEvent(escapeEvent);
            }, 100);
            
            toast.success(`Selected option ${number}: ${selectedValue}`);
            return;
          } else {
            toast.error(`Option ${number} not available (${fieldConfig.dropdownOptions.length} options)`);
            return;
          }
        } else {
          console.log('Field config not found or not a dropdown');
        }
      } else {
        console.log('Field name or output config not found');
      }
      
      // For shadcn Select components - be more specific about which dropdown we're targeting
      const selectTrigger = focusedElement.closest('[role="combobox"]') || focusedElement;
      
      // Click to open the dropdown
      (selectTrigger as HTMLElement).click();
      
      // Wait a bit for the dropdown to open, then try to select the option
      setTimeout(() => {
        // Look for the SelectContent (dropdown options) - be more specific
        let selectContent = null;
        
        // Try multiple approaches to find the correct dropdown content
        const allSelectContents = document.querySelectorAll('[data-radix-popper-content-wrapper]');
        
        // Find the one that's currently visible/open
        for (const content of allSelectContents) {
          const style = window.getComputedStyle(content);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            selectContent = content;
            break;
          }
        }
        
        if (!selectContent) {
          // Fallback to any visible dropdown
          selectContent = document.querySelector('[data-radix-popper-content-wrapper]:not([style*="display: none"])');
        }
        
        if (selectContent) {
          const options = selectContent.querySelectorAll('[role="option"], [data-radix-collection-item]');
          const targetIndex = number - 1; // Convert to 0-based index
          
          if (targetIndex >= 0 && targetIndex < options.length) {
            const selectedOption = options[targetIndex] as HTMLElement;
            selectedOption.click();
            toast.success(`Selected option ${number}: ${selectedOption.textContent}`);
          } else {
            toast.error(`Option ${number} not available (${options.length} options)`);
          }
        } else {
          // Fallback: try to find options in the document
          const allOptions = document.querySelectorAll('[role="option"], [data-radix-collection-item]');
          const targetIndex = number - 1;
          
          if (targetIndex >= 0 && targetIndex < allOptions.length) {
            const selectedOption = allOptions[targetIndex] as HTMLElement;
            selectedOption.click();
            toast.success(`Selected option ${number}: ${selectedOption.textContent}`);
          } else {
            toast.error(`Option ${number} not available (${allOptions.length} options)`);
          }
        }
      }, 300); // Increased timeout to give more time for dropdown to open
    } else {
      toast.error('Not a dropdown field');
    }
  }, [outputConfig, setValue]);

  // Enhanced config with dropdown selection
  const finalConfig: KeyboardShortcutConfig = useMemo(() => ({
    ...enhancedConfig,
    onSelectDropdownValue: selectDropdownValueByNumber
  }), [enhancedConfig, selectDropdownValueByNumber]);

  useEffect(() => {
    if (!enabled) return;

    // Global Enter key prevention for dropdowns (capture phase)
    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (!preventEnterOnDropdowns(event)) {
        // If preventEnterOnDropdowns returned false, handle form submission
        setTimeout(() => {
          if (canAnnotate && handlers.onSubmit) {
            const decisionVal = watch ? watch('decision') : undefined;
            if (useLegacyMode && !decisionVal) {
              toast.error('Please select a decision first');
              return;
            }
            if (!useLegacyMode && outputConfig) {
              const requiredFields = outputConfig.filter((field: OutputField) => field.required);
              const missingField = requiredFields.find((field: OutputField) => !watch?.(field.name));
              if (missingField) {
                toast.error(`Please fill in: ${missingField.description || missingField.name}`);
                return;
              }
            }
            handlers.onSubmit();
          }
        }, 50);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Alt + C/S navigation even when focused on input fields
      if (event.altKey && !event.ctrlKey && !event.shiftKey) {
        switch (event.code) {
          case 'KeyZ':
            event.preventDefault();
            finalConfig.onFocusFirst?.();
            return;
          case 'KeyX':
            event.preventDefault();
            finalConfig.onFocusLast?.();
            return;
          case 'Digit1':
            event.preventDefault();
            finalConfig.onFocusByIndex?.(1);
            return;
          case 'Digit2':
            event.preventDefault();
            finalConfig.onFocusByIndex?.(2);
            return;
          case 'Digit3':
            event.preventDefault();
            finalConfig.onFocusByIndex?.(3);
            return;
          case 'Digit4':
            event.preventDefault();
            finalConfig.onFocusByIndex?.(4);
            return;
          case 'Digit5':
            event.preventDefault();
            finalConfig.onFocusByIndex?.(5);
            return;
          case 'Digit6':
            event.preventDefault();
            finalConfig.onFocusByIndex?.(6);
            return;
          case 'Digit7':
            event.preventDefault();
            finalConfig.onFocusByIndex?.(7);
            return;
          case 'Digit8':
            event.preventDefault();
            finalConfig.onFocusByIndex?.(8);
            return;
          case 'Digit9':
            event.preventDefault();
            finalConfig.onFocusByIndex?.(9);
            return;
          case 'Digit0':
            event.preventDefault();
            finalConfig.onFocusByIndex?.(10);
            return;
          case 'Backspace':
            event.preventDefault();
            finalConfig.onClearField?.();
            return;
          case 'KeyE':
            event.preventDefault();
            finalConfig.onOpenImage?.();
            return;
          case 'Enter':
          case 'KeyM':
            event.preventDefault();
            finalConfig.onFocusComment?.();
            return;
        }
      }

      // Handle number keys for dropdown selection (when focused on dropdowns)
      if (!event.altKey && !event.ctrlKey && !event.shiftKey) {
        const focusedElement = document.activeElement;
        const isDropdown = isDropdownField(focusedElement);
        
        if (isDropdown) {
          switch (event.code) {
            case 'Digit1':
              event.preventDefault();
              finalConfig.onSelectDropdownValue?.(1);
              return;
            case 'Digit2':
              event.preventDefault();
              finalConfig.onSelectDropdownValue?.(2);
              return;
            case 'Digit3':
              event.preventDefault();
              finalConfig.onSelectDropdownValue?.(3);
              return;
            case 'Digit4':
              event.preventDefault();
              finalConfig.onSelectDropdownValue?.(4);
              return;
            case 'Digit5':
              event.preventDefault();
              finalConfig.onSelectDropdownValue?.(5);
              return;
            case 'Digit6':
              event.preventDefault();
              finalConfig.onSelectDropdownValue?.(6);
              return;
            case 'Digit7':
              event.preventDefault();
              finalConfig.onSelectDropdownValue?.(7);
              return;
            case 'Digit8':
              event.preventDefault();
              finalConfig.onSelectDropdownValue?.(8);
              return;
            case 'Digit9':
              event.preventDefault();
              finalConfig.onSelectDropdownValue?.(9);
              return;
          }
        }
      }

      // Don't trigger other shortcuts when typing in input fields
      if (isInputField(event.target as Element)) {
        return;
      }

      // Prevent default behavior for our shortcuts (but not Alt combinations)
      const shortcuts = [
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Enter', 'Space', 'KeyH', 'Escape', 'Tab'
      ];

      // Only prevent default for non-Alt combinations
      if (shortcuts.includes(event.code) && !event.altKey) {
        event.preventDefault();
      }

      // Handle Ctrl key combinations (for image navigation only)
      if (event.ctrlKey && !event.altKey && !event.shiftKey) {
        switch (event.code) {
          case 'ArrowLeft':
            handlers.onPreviousImage?.();
            return;
          case 'ArrowRight':
            handlers.onNextImage?.();
            return;
        }
      }

      // Handle Ctrl+Alt key combinations (for task navigation)
      if (event.ctrlKey && event.altKey && !event.shiftKey) {
        switch (event.code) {
          case 'ArrowLeft':
            if (canGoToPrevious) handlers.onPreviousTask?.();
            return;
          case 'ArrowRight':
            if (canGoToNext) handlers.onNextTask?.();
            return;
        }
      }

      // Handle regular shortcuts (no modifiers)
      if (!event.ctrlKey && !event.altKey && !event.shiftKey) {
        switch (event.code) {
          case 'ArrowLeft':
          case 'KeyA':
            if (canGoToPrevious) handlers.onPreviousTask?.();
            break;

          case 'ArrowRight':
          case 'KeyD':
            if (canGoToNext) handlers.onNextTask?.();
            break;

          case 'Enter':
            if (canAnnotate && handlers.onSubmit) {
              // In legacy mode, check if decision is selected
              const decisionVal2 = watch ? watch('decision') : undefined;
              if (useLegacyMode && !decisionVal2) {
                toast.error('Please select a decision first');
                break;
              }
              // In dynamic mode, check if required fields are filled
              if (!useLegacyMode && outputConfig) {
                const requiredFields = outputConfig.filter((field: OutputField) => field.required);
                const missingField = requiredFields.find((field: OutputField) => !watch?.(field.name));
                if (missingField) {
                  toast.error(`Please fill in: ${missingField.description || missingField.name}`);
                  break;
                }
              }
              handlers.onSubmit();
            }
            break;

          case 'Space':
            if (canGoToNext) handlers.onSkipTask?.();
            break;

          case 'KeyH':
            handlers.onToggleShortcuts?.();
            break;

          case 'Escape':
            handlers.onCloseShortcuts?.();
            break;
        }
      }
    };

    // Add capture phase listener for Enter key prevention
    document.addEventListener('keydown', handleKeyDownCapture, true);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDownCapture, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    enabled,
    handlers,
    canGoToNext,
    canGoToPrevious,
    canAnnotate,
    useLegacyMode,
    outputConfig,
    watch,
    finalConfig
  ]);

  return {
    selectDropdownValueByNumber,
    closeAllDropdowns,
    autoOpenDropdown,
    focusFirstInput: () => focusFirstInput(finalConfig),
    focusLastInput: () => focusLastInput(finalConfig),
    focusInputByIndex: (index: number) => focusInputByIndex(index, finalConfig),
    focusCommentField,
    clearCurrentField,
    toggleDropdown,
    openImageInNewTab: () => currentTaskData && openImageInNewTab(currentTaskData, currentImageIndex)
  };
};
