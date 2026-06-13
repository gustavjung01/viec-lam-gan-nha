set -e

echo "Test no token account:"
curl -s -o /tmp/account-no-token.json -w "%{http_code}" http://127.0.0.1:3001/api/account/me
echo
cat /tmp/account-no-token.json
echo

echo "Test fake token account:"
curl -s -o /tmp/account-fake-token.json -w "%{http_code}" -H "Authorization: Bearer fake-token" http://127.0.0.1:3001/api/account/me
echo
cat /tmp/account-fake-token.json
echo

echo "Test admin no token:"
curl -s -o /tmp/admin-no-token.json -w "%{http_code}" http://127.0.0.1:3001/api/admin/pending-ctv
echo
cat /tmp/admin-no-token.json
echo

echo "Test admin token from root-only file, do not print token:"
ADMIN_TOKEN=$(sudo cat /root/vlgn-admin-token.txt)
curl -s -o /tmp/admin-pending-ctv.json -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:3001/api/admin/pending-ctv
echo
cat /tmp/admin-pending-ctv.json
echo
