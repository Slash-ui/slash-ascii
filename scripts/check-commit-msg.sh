#!/bin/sh
# Validate one commit message against the subset of Conventional Commits this
# repo uses. The commit-msg hook and the ci workflow both call this, so what
# passes locally is exactly what passes on a pull request.
#
#   scripts/check-commit-msg.sh <message-file>
#   scripts/check-commit-msg.sh --subject "<subject line>"
#
# The types are the ones release-please understands. feat bumps the minor,
# fix and perf bump the patch, a ! after the type or a BREAKING CHANGE footer
# bumps the major; the rest do not release anything on their own.

set -u

TYPES='build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test'
MAX_SUBJECT=72

usage() {
  echo "usage: check-commit-msg.sh <message-file>" >&2
  echo "       check-commit-msg.sh --subject <subject line>" >&2
  exit 2
}

second=''
case ${1:-} in
  --subject)
    [ $# -eq 2 ] || usage
    full=$2
    subject=$2
    ;;
  '' | -*)
    usage
    ;;
  *)
    [ -f "$1" ] || { echo "no such file: $1" >&2; exit 2; }
    # git drops comment lines before storing the message, so drop them here
    # too. Otherwise the commented template reads as a body.
    full=$(sed '/^#/d' "$1")
    subject=$(printf '%s\n' "$full" | sed -n '1p')
    second=$(printf '%s\n' "$full" | sed -n '2p')
    ;;
esac

errors=0
fail() {
  echo "  - $1" >&2
  errors=$((errors + 1))
}

# git writes these itself and reads them back by their exact shape, so
# reformatting them to fit the convention would break more than it tidies.
case $subject in
  'Merge '* | 'Revert '* | 'fixup! '* | 'squash! '* | 'amend! '*) exit 0 ;;
esac

if printf '%s' "$subject" | grep -qE "^($TYPES)(\([a-z0-9][a-z0-9._/-]*\))?!?: .+"; then
  description=${subject#*: }

  if [ ${#subject} -gt $MAX_SUBJECT ]; then
    fail "subject is ${#subject} characters, keep it to $MAX_SUBJECT"
  fi

  case $subject in
    *.) fail "subject should not end in a period" ;;
  esac

  # A leading capital is a sentence start, which reads wrong once the line is
  # pasted into a changelog. A run of capitals is an acronym, which is fine.
  if printf '%s' "$description" | grep -qE '^[A-Z][a-z]'; then
    fail "description should not start with a capital"
  fi
else
  fail "subject must be 'type(optional scope): description'"
  fail "types: $(echo "$TYPES" | tr '|' ' ')"
fi

if [ -n "$second" ]; then
  fail "leave a blank line between the subject and the body"
fi

# Tooling metadata says nothing about the change and outlives the tool that
# wrote it.
if printf '%s' "$full" | grep -qiE 'co-authored-by:.*(claude|copilot|bot@)|generated with|🤖'; then
  fail "message contains tooling metadata"
fi

if [ $errors -gt 0 ]; then
  echo "" >&2
  echo "rejected commit message:" >&2
  echo "" >&2
  printf '%s\n' "$subject" | sed 's/^/  /' >&2
  echo "" >&2
  echo "see CONTRIBUTING.md for the convention" >&2
  exit 1
fi
