/**
 * Reusable keyboard shortcuts modal component
 * Can be used across different pages with customizable shortcuts
 */

import { Button } from '@/components/ui/button';

export interface ShortcutItem {
  key: string;
  description: string;
  category?: string;
}

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  shortcuts: {
    [category: string]: ShortcutItem[];
  };
  className?: string;
}

export function ShortcutsModal({ 
  isOpen, 
  onClose, 
  title = "Keyboard Shortcuts",
  shortcuts,
  className = ""
}: ShortcutsModalProps) {
  if (!isOpen) return null;

  // Extract categories in the exact order they should appear
  const taskNav = shortcuts["Task Navigation"] || [];
  const actions = shortcuts["Actions"] || [];
  const imageNav = shortcuts["Image Navigation"] || [];
  const inputActions = shortcuts["Input Actions"] || [];
  const help = shortcuts["Help"] || [];

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 ${className}`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            ×
          </Button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Task Navigation</h4>
              <div className="space-y-1 text-gray-600">
                {taskNav.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.key}</span>
                    <span>{item.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Actions</h4>
              <div className="space-y-1 text-gray-600">
                {actions.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.key}</span>
                    <span>{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Image Navigation</h4>
              <div className="space-y-1 text-gray-600">
                {imageNav.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.key}</span>
                    <span>{item.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Input Actions</h4>
              <div className="space-y-1 text-gray-600">
                {inputActions.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.key}</span>
                    <span>{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t">
            {help.map((item, index) => (
              <div key={index} className="flex justify-between text-gray-600">
                <span>{item.key}</span>
                <span>{item.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p>Shortcuts work when not typing in input fields</p>
        </div>
      </div>
    </div>
  );
}
// Predefined shortcut configurations for common use cases
export const annotationShortcuts = {
  "Task Navigation": [
    { key: "Ctrl+Alt+←", description: "Previous task" },
    { key: "Ctrl+Alt+→", description: "Next task" },
    { key: "Space", description: "Skip to next" },
  ],
  "Actions": [
    { key: "Enter", description: "Submit" },
    { key: "1-9", description: "Select dropdown value" },
  ],
  "Image Navigation": [
    { key: "Ctrl + ←", description: "Previous image" },
    { key: "Ctrl + →", description: "Next image" },
    { key: "Alt + E", description: "Open image in new tab" },
  ],
  "Input Actions": [
    { key: "Alt + Z", description: "First field" },
    { key: "Alt + X", description: "Last field" },
    { key: "Alt + 1", description: "Field 1" },
    { key: "Alt + 2", description: "Field 2" },
    { key: "Alt + 3", description: "Field 3" },
    { key: "Alt + 4", description: "Field 4" },
    { key: "Alt + 5", description: "Field 5" },
    { key: "Alt + 6-0", description: "Fields 6-10" },
    { key: "Alt + Backspace", description: "Clear field" },
    { key: "Alt + M", description: "Comment field" },
  ],
  "Help": [
    { key: "H", description: "Toggle this help" },
    { key: "Esc", description: "Close help" },
  ]
};

