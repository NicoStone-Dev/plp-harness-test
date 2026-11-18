import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { filter, map, startWith, Subject } from 'rxjs';
import { normalizeName } from '../../domain/events';

@Component({
  selector: 'app-join',
  imports: [AsyncPipe, ReactiveFormsModule],
  templateUrl: './join.html',
  styleUrl: './join.css',
})
export class Join {
  protected readonly name = new FormControl('', { nonNullable: true });

  /** "Entrar" is enabled only for a valid name (FR-01). */
  protected readonly canJoin$ = this.name.valueChanges.pipe(
    startWith(this.name.value),
    map((value) => normalizeName(value) !== null),
  );

  protected readonly submit$ = new Subject<void>();

  /** The trimmed, validated name. */
  readonly joined = outputFromObservable(
    this.submit$.pipe(
      map(() => normalizeName(this.name.value)),
      filter((name): name is string => name !== null),
    ),
  );
}
