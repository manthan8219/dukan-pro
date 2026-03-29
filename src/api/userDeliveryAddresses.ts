import { getApiBase } from './baseUrl';
import type { AddressTag } from '../pages/customer/customerDeliveryTypes';

export type UserDeliveryAddressDto = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  pin: string;
  tag: AddressTag;
  label: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
};

export type CreateUserDeliveryAddressPayload = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  pin: string;
  tag: AddressTag;
  label?: string;
  setAsDefault?: boolean;
  latitude?: number;
  longitude?: number;
};

export type UpdateUserDeliveryAddressPayload = Partial<CreateUserDeliveryAddressPayload>;

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let msg = text || res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(j.message)) msg = j.message.join(', ');
      else if (typeof j.message === 'string') msg = j.message;
    } catch {
      /* keep msg */
    }
    throw new Error(msg);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function listUserDeliveryAddresses(
  userId: string,
): Promise<UserDeliveryAddressDto[]> {
  const res = await fetch(`${getApiBase()}/users/${userId}/delivery-addresses`);
  return parseJson<UserDeliveryAddressDto[]>(res);
}

export async function createUserDeliveryAddress(
  userId: string,
  body: CreateUserDeliveryAddressPayload,
): Promise<UserDeliveryAddressDto> {
  const res = await fetch(`${getApiBase()}/users/${userId}/delivery-addresses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson<UserDeliveryAddressDto>(res);
}

export async function updateUserDeliveryAddress(
  userId: string,
  addressId: string,
  body: UpdateUserDeliveryAddressPayload,
): Promise<UserDeliveryAddressDto> {
  const res = await fetch(
    `${getApiBase()}/users/${userId}/delivery-addresses/${addressId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return parseJson<UserDeliveryAddressDto>(res);
}

export async function deleteUserDeliveryAddress(
  userId: string,
  addressId: string,
): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/users/${userId}/delivery-addresses/${addressId}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
}
