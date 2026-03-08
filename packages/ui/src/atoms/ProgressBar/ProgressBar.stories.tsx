import type { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from './ProgressBar';

const meta: Meta<typeof ProgressBar> = {
  title: 'Atoms/ProgressBar',
  component: ProgressBar,
  decorators: [(Story) => <div className="w-96"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = { args: { value: 60 } };
export const WithLabel: Story = { args: { value: 42, label: '21 / 50 reviewed' } };
export const Empty: Story = { args: { value: 0, label: 'Progress' } };
export const Full: Story = { args: { value: 100, label: 'Progress' } };
