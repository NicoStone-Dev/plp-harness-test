import { outputToObservable } from '@angular/core/rxjs-interop';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Join } from './join';

describe('Join (FR-01)', () => {
  let fixture: ComponentFixture<Join>;
  let input: HTMLInputElement;
  let button: HTMLButtonElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Join);
    await fixture.whenStable();
    input = fixture.nativeElement.querySelector('input');
    button = fixture.nativeElement.querySelector('button[type=submit]');
  });

  async function type(value: string): Promise<void> {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('disables "Entrar" while the name is empty or blank', async () => {
    expect(button.disabled).toBe(true);
    await type('   ');
    expect(button.disabled).toBe(true);
    await type('Ana');
    expect(button.disabled).toBe(false);
    await type('x'.repeat(21));
    expect(button.disabled).toBe(true);
  });

  it('emits the trimmed name on submit', async () => {
    const joined = firstValueFrom(outputToObservable(fixture.componentInstance.joined));
    await type('  Ana  ');
    button.click();
    expect(await joined).toBe('Ana');
  });
});
