package com.grandstay.shared.infrastructure.persistence;

import java.io.Serializable;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.usertype.UserType;

public class PostgresTstzRangeType implements UserType<String> {
    @Override
    public int getSqlType() { return Types.OTHER; }

    @Override
    public Class<String> returnedClass() { return String.class; }

    @Override
    public boolean equals(String left, String right) {
        return left == right || left != null && left.equals(right);
    }

    @Override
    public int hashCode(String value) { return value == null ? 0 : value.hashCode(); }

    @Override
    public String nullSafeGet(ResultSet resultSet, int position,
                              SharedSessionContractImplementor session, Object owner) throws SQLException {
        return resultSet.getString(position);
    }

    @Override
    public void nullSafeSet(PreparedStatement statement, String value, int index,
                            SharedSessionContractImplementor session) throws SQLException {
        if (value == null) statement.setNull(index, Types.OTHER);
        else statement.setObject(index, value, Types.OTHER);
    }

    @Override
    public String deepCopy(String value) { return value; }

    @Override
    public boolean isMutable() { return false; }

    @Override
    public Serializable disassemble(String value) { return value; }

    @Override
    public String assemble(Serializable cached, Object owner) { return (String) cached; }

    @Override
    public String replace(String detached, String managed, Object owner) { return detached; }
}
