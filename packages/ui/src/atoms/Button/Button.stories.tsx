import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  args: { children: 'Button' },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary', size: 'lg' } };
export const Secondary: Story = { args: { variant: 'secondary', size: 'lg' } };
export const Success: Story = { args: { variant: 'success', size: 'lg' } };
export const Danger: Story = { args: { variant: 'danger', size: 'lg' } };
export const Small: Story = { args: { variant: 'primary', size: 'sm' } };
export const Disabled: Story = { args: { variant: 'primary', size: 'lg', disabled: true } };
