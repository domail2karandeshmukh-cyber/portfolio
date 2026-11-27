#!/usr/bin/env bash
# Reset a user's one-time password with Keycloak's admin REST API: the commands of the guide's REST section, run as
# written. Needs KC_URL, REALM, KC_ADMIN, KC_ADMIN_PASSWORD and USERNAME in the environment. Prints each response.
set -euo pipefail

# 1. A token for the admin REST API (master realm, admin-cli client).
TOKEN=$(curl -s "$KC_URL/realms/master/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=admin-cli \
  --data-urlencode "username=$KC_ADMIN" --data-urlencode "password=$KC_ADMIN_PASSWORD" | jq -r .access_token)
AUTH=(-H "Authorization: Bearer $TOKEN")

# 2. The user's ID.
USER_ID=$(curl -s "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/users?username=$USERNAME&exact=true" | jq -r '.[0].id')
echo "user: $USERNAME"

# 3. The user's OTP credentials.
echo "credentials before:"; curl -s "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/users/$USER_ID/credentials" | jq -c '[.[] | {type, userLabel}]'
OTP_IDS=$(curl -s "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/users/$USER_ID/credentials" | jq -r '.[] | select(.type == "otp") | .id')

# 4. Delete each OTP credential.
for ID in $OTP_IDS; do
  echo "DELETE credential: HTTP $(curl -s -o /dev/null -w '%{http_code}' -X DELETE "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/users/$USER_ID/credentials/$ID")"
done

# 5. Add CONFIGURE_TOTP to the user's required actions, keeping the ones already there.
ACTIONS=$(curl -s "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/users/$USER_ID" | jq -c '.requiredActions + ["CONFIGURE_TOTP"] | unique')
echo "PUT requiredActions $ACTIONS: HTTP $(curl -s -o /dev/null -w '%{http_code}' -X PUT "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"requiredActions\": $ACTIONS}" "$KC_URL/admin/realms/$REALM/users/$USER_ID")"

# 6. Check.
echo "credentials after:"; curl -s "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/users/$USER_ID/credentials" | jq -c '[.[] | {type, userLabel}]'
echo "requiredActions after:"; curl -s "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/users/$USER_ID" | jq -c '.requiredActions'
