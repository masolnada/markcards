import type { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from './ProgressBar';

const meta: Meta<typeof ProgressBar> = {
  title: 'Atoms/ProgressBar',
  component: ProgressBar,
  decorators: [(Story) => <div className="w-96"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = { args: { value: 42, label: '21 / 50' } };
