import type { Meta, StoryObj } from '@storybook/react';
import { CardSummary } from './CardSummary';

const meta: Meta<typeof CardSummary> = {
  title: 'Molecules/CardSummary',
  component: CardSummary,
};
export default meta;

type Story = StoryObj<typeof CardSummary>;

export const Default: Story = {
  args: {
    promptHtml: '<p>What is the capital of France?</p>',
    revealHtml: '<p>Paris</p>',
  },
};

export const WithCode: Story = {
  args: {
    promptHtml: '<p>What does <code>Array.prototype.map</code> return?</p>',
    revealHtml: '<p>A new array with each element transformed by the callback function.</p>',
  },
};

export const WithImage: Story = {
  args: {
    promptHtml: '<p>Identify this element</p><img src="https://via.placeholder.com/300x200" alt="placeholder" />',
    revealHtml: '<p>Placeholder element</p>',
  },
};
