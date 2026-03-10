import type { Meta, StoryObj } from '@storybook/react';
import { SidePanel } from './SidePanel';

const meta: Meta<typeof SidePanel> = {
  title: 'Molecules/SidePanel',
  component: SidePanel,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof SidePanel>;

export const Open: Story = {
  args: {
    open: true,
    title: 'Deck: Introduction to TypeScript',
    onClose: () => {},
    children: (
      <div className="flex flex-col gap-2">
        <div className="border border-border p-2 text-sm">
          <p className="font-semibold mb-1">Q: What is TypeScript?</p>
          <p className="text-muted-foreground">A typed superset of JavaScript.</p>
        </div>
        <div className="border border-border p-2 text-sm">
          <p className="font-semibold mb-1">Q: What does <code>interface</code> do?</p>
          <p className="text-muted-foreground">Defines the shape of an object.</p>
        </div>
      </div>
    ),
  },
};

export const Closed: Story = {
  args: {
    open: false,
    title: 'Deck: Introduction to TypeScript',
    onClose: () => {},
    children: null,
  },
};
