import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
  args: { children: '12 new' },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Primary: Story = { args: { variant: 'primary' } };
